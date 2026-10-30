/// Packaged document metadata passed from the asset service to HTTP transport.
#[derive(Clone, Copy)]
pub struct Asset {
    pub path: &'static str,
    pub bytes: &'static [u8],
    pub etag: &'static str,
    pub immutable: bool,
}
