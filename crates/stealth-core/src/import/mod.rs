pub mod epub;
pub mod limits;
pub mod pipeline;
pub mod txt;

pub use pipeline::{parse_bytes, parse_file};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub stage: &'static str,
    pub percent: u8,
    pub completed: usize,
    pub total: usize,
}

impl ImportProgress {
    pub fn new(stage: &'static str, percent: u8, completed: usize, total: usize) -> Self {
        Self {
            stage,
            percent,
            completed,
            total,
        }
    }
}
