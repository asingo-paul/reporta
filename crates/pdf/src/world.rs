use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{Datelike, Utc};
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_kit::fonts::FontStore;

/// A minimal, in-memory [`World`] for compiling one self-contained report.
/// There is exactly one source file (built fresh per report) and a small set
/// of virtual asset files (the agency logo, chart SVGs) — no filesystem
/// access and no package downloads, which keeps report rendering fast and
/// removes an entire class of SSRF/path-traversal concerns that a
/// disk-or-network-backed `World` would otherwise need to guard against.
pub struct ReportWorld {
    library: LazyHash<Library>,
    fonts: FontStore,
    main_id: FileId,
    main_source: Source,
    assets: HashMap<String, Bytes>,
    today: Datetime,
}

impl ReportWorld {
    pub fn new(main_text: String, assets: HashMap<String, Vec<u8>>) -> Self {
        let vpath = VirtualPath::new("main.typ").expect("static path is valid");
        let main_id = RootedPath::new(VirtualRoot::Project, vpath).intern();
        let main_source = Source::new(main_id, main_text);

        let mut fonts = FontStore::new();
        fonts.extend(typst_kit::fonts::embedded());

        let now = Utc::now();
        let today = Datetime::from_ymd(now.year(), now.month() as u8, now.day() as u8)
            .expect("current date is always valid");

        Self {
            library: LazyHash::new(Library::default()),
            fonts,
            main_id,
            main_source,
            assets: assets
                .into_iter()
                .map(|(name, bytes)| (name, Bytes::new(bytes)))
                .collect(),
            today,
        }
    }

    fn asset_bytes(&self, id: FileId) -> FileResult<Bytes> {
        let name = id.vpath().get_without_slash();
        self.assets
            .get(name)
            .cloned()
            .ok_or_else(|| FileError::NotFound(PathBuf::from(name)))
    }
}

impl World for ReportWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        self.fonts.book()
    }

    fn main(&self) -> FileId {
        self.main_id
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main_id {
            Ok(self.main_source.clone())
        } else {
            Err(FileError::NotFound(PathBuf::from(id.vpath().get_without_slash())))
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.asset_bytes(id)
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.font(index)
    }

    fn today(&self, _offset: Option<typst::foundations::Duration>) -> Option<Datetime> {
        Some(self.today)
    }
}
