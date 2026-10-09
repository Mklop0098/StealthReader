use serde::ser::{SerializeMap, Serializer};
use serde::Serialize;

use stealth_core::error::{CoreError, ErrorCode};

/// Wire error shape shared with the frontend `AppError` interface.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>, recoverable: bool) -> Self {
        AppError {
            code: code.as_str().to_string(),
            message: message.into(),
            recoverable,
        }
    }
}

impl From<CoreError> for AppError {
    fn from(err: CoreError) -> Self {
        AppError::new(err.code(), err.to_string(), err.recoverable())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::from(CoreError::Io(err))
    }
}

/// Success/failure envelope returned by every command. The frontend unwraps it
/// through a single validator, so failures never surface as raw strings.
pub struct IpcResult<T>(pub Result<T, AppError>);

impl<T> IpcResult<T> {
    pub fn ok(value: T) -> Self {
        IpcResult(Ok(value))
    }
}

impl<T> From<Result<T, CoreError>> for IpcResult<T> {
    fn from(result: Result<T, CoreError>) -> Self {
        IpcResult(result.map_err(AppError::from))
    }
}

impl<T> From<Result<T, AppError>> for IpcResult<T> {
    fn from(result: Result<T, AppError>) -> Self {
        IpcResult(result)
    }
}

impl<T> From<AppError> for IpcResult<T> {
    fn from(error: AppError) -> Self {
        IpcResult(Err(error))
    }
}

impl<T: Serialize> Serialize for IpcResult<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match &self.0 {
            Ok(value) => {
                let mut map = serializer.serialize_map(Some(2))?;
                map.serialize_entry("ok", &true)?;
                map.serialize_entry("value", value)?;
                map.end()
            }
            Err(error) => {
                let mut map = serializer.serialize_map(Some(2))?;
                map.serialize_entry("ok", &false)?;
                map.serialize_entry("error", error)?;
                map.end()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_core_error_codes_and_recoverability() {
        let not_found = AppError::from(CoreError::NotFound("book 1".into()));
        assert_eq!(not_found.code, "NOT_FOUND");
        assert!(not_found.recoverable);

        let db = AppError::new(ErrorCode::DbError, "database unavailable", false);
        assert_eq!(db.code, "DB_ERROR");
        assert!(!db.recoverable);

        let invalid = AppError::from(CoreError::InvalidInput("bad".into()));
        assert_eq!(invalid.code, "INVALID_INPUT");
    }

    #[test]
    fn serializes_the_ok_envelope() {
        let envelope = IpcResult::ok(7_i32);
        let json = serde_json::to_value(&envelope).expect("serialize");
        assert_eq!(json["ok"], serde_json::json!(true));
        assert_eq!(json["value"], serde_json::json!(7));
    }

    #[test]
    fn serializes_the_error_envelope() {
        let envelope: IpcResult<i32> =
            AppError::new(ErrorCode::ShortcutUnavailable, "taken", true).into();
        let json = serde_json::to_value(&envelope).expect("serialize");
        assert_eq!(json["ok"], serde_json::json!(false));
        assert_eq!(
            json["error"]["code"],
            serde_json::json!("SHORTCUT_UNAVAILABLE")
        );
        assert_eq!(json["error"]["recoverable"], serde_json::json!(true));
    }

    #[test]
    fn propagates_core_results_into_the_envelope() {
        let ok: IpcResult<i32> = Result::<i32, CoreError>::Ok(3).into();
        assert_eq!(
            serde_json::to_value(&ok).unwrap()["value"],
            serde_json::json!(3)
        );

        let err: IpcResult<i32> =
            Result::<i32, CoreError>::Err(CoreError::NotFound("x".into())).into();
        assert_eq!(
            serde_json::to_value(&err).unwrap()["error"]["code"],
            serde_json::json!("NOT_FOUND")
        );
    }
}
