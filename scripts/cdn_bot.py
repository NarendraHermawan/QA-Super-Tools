from __future__ import annotations
import os, re, json, time, mimetypes, pathlib, requests, gspread, traceback
import sys
from urllib.parse import urlparse, unquote
from google.oauth2.service_account import Credentials
from slugify import slugify
from typing import Dict, List, Optional, Tuple
import httpx  # <-- SeaTalk notify
from io import BytesIO
from pathlib import Path


if sys.version_info[0] >= 3:
    unicode = str


try:
    from PIL import Image
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False
    Image = None


# Google Drive API (safe import)
try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    GOOGLE_DRIVE_AVAILABLE = True
except Exception:
    build = None
    MediaIoBaseDownload = None
    GOOGLE_DRIVE_AVAILABLE = False


"""
Script: notion_asset_match_from_sheets.py (+ SeaTalk notify)  [UPDATED]
Changes:
  - CDN API uses filename from SHEET (not Notion)
  - Match Notion/Drive by basename AND extension (ff_extend => jpg)
  - Report errors: no match, oversize; try resize > 600 KB images
  - Mark Column L checkbox TRUE on successful upload
Dependencies:
  pip install gspread google-auth google-api-python-client requests python-slugify httpx pillow
"""


# =========================
# CONFIG
# =========================


SHEET_TITLE = os.environ.get("SHEET_TITLE", "[FFID] Weekly CDN Checklist")
TOOL_F_SHEET_TAB = os.environ.get("TOOL_F_SHEET_TAB", "").strip()
TOOL_F_SUB_WEEK = os.environ.get("TOOL_F_SUB_WEEK", "").strip()
# SHEET_TITLE = "test bot cdn"
FF_BASE = "https://dl.dir.freefiremobile.com/"
DOWNLOAD_BASE = os.environ.get("DOWNLOAD_BASE", "./downloads")
MAX_SIZE_BYTES = 600 * 1024  # 600 KB
os.makedirs(DOWNLOAD_BASE, exist_ok=True)


# --- SeaTalk Webhook ---
BOT_WEBHOOK_URL = os.environ.get("SEATALK_WEBHOOK_URL", "")


def seatalk_notify(content: str, format_plain: bool = True, max_length: int = 3245) -> None:
    """
    Send notification to SeaTalk, splitting into multiple messages if content is too long.
    Splits by complete lines to avoid cutting messages in the middle.
    """
    if not BOT_WEBHOOK_URL:
        return
   
    # If content is short enough, send it directly
    if len(content) <= max_length:
        payload = {
            "tag": "text",
            "text": {"format": 2 if format_plain else 1, "content": content},
        }
        try:
            httpx.post(BOT_WEBHOOK_URL, json=payload, timeout=10.0)
        except Exception:
            pass
        return
   
    # Split into chunks by complete lines
    lines = content.split('\n')
    current_chunk = []
    current_length = 0
   
    for line in lines:
        line_length = len(line) + 1  # +1 for newline character
       
        # If adding this line would exceed max_length, send current chunk and start new one
        if current_length + line_length > max_length and current_chunk:
            chunk_content = '\n'.join(current_chunk)
            payload = {
                "tag": "text",
                "text": {"format": 2 if format_plain else 1, "content": chunk_content},
            }
            try:
                httpx.post(BOT_WEBHOOK_URL, json=payload, timeout=10.0)
                time.sleep(0.5)  # Small delay between messages
            except Exception:
                pass
           
            # Start new chunk with this line
            current_chunk = [line]
            current_length = line_length
        else:
            current_chunk.append(line)
            current_length += line_length
   
    # Send remaining chunk if any
    if current_chunk:
        chunk_content = '\n'.join(current_chunk)
        payload = {
            "tag": "text",
            "text": {"format": 2 if format_plain else 1, "content": chunk_content},
        }
        try:
            httpx.post(BOT_WEBHOOK_URL, json=payload, timeout=10.0)
        except Exception:
            pass


# =========================
# CREDENTIALS (from environment)
# =========================
def _load_sheet_credentials() -> str:
    inline = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if inline:
        return inline
    key_path = os.environ.get(
        "GOOGLE_SERVICE_ACCOUNT_KEY", "./credentials/service-account.json"
    )
    if os.path.isfile(key_path):
        with open(key_path, encoding="utf-8") as f:
            return f.read()
    raise SystemExit(
        "GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY is required"
    )


sheet_credentials = _load_sheet_credentials()
notion_token = os.environ.get("NOTION_API_TOKEN", "")
token = os.environ.get("CDN_API_TOKEN", "")


# =========================
# LIGHTWEIGHT LOG BUFFER
# =========================
class LogBuf:
    def __init__(self, keep_tail: int = 40):
        self.lines: List[str] = []
        self.keep_tail = keep_tail
    def add(self, *parts):
        msg = " ".join(str(p) for p in parts)
        print(msg)
        self.lines.append(msg)
        if len(self.lines) > 1000:
            self.lines = self.lines[-self.keep_tail:]
    def tail(self, n: Optional[int] = None) -> str:
        n = n or self.keep_tail
        return "\n".join(self.lines[-n:])


LOG = LogBuf()


# --------------------------------------------------------------------
# CDN UPLOADER
# --------------------------------------------------------------------
def upload_file(folder_name, file_name, file_path, token, base_url="https://cdnops.jingle.cn/api/public"):
    if not os.path.exists(file_path):
        raise SystemExit(f"File not found: {file_path}")


    def ensure_folders(remote_path: str):
        parts = [p for p in remote_path.strip("/").split("/") if p]
        current = "/"
        for part in parts:
            hdrs = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
            form = {"path": current, "name": part}
            r = requests.post(f"{base_url}/folder", headers=hdrs, data=form)
            if r.status_code not in (200, 409):
                LOG.add(f"Warning: failed to create folder {current}{part}: {r.status_code}")
            current = (current.rstrip("/") + "/" + part).replace("//", "/")


    ensure_folders(folder_name)
    size = os.path.getsize(file_path)
    hdrs = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    pre_body = {"name": file_name, "path": folder_name, "size": str(size), "overwrite": "true"}
    r1 = requests.post(f"{base_url}/precreate", headers=hdrs, data=pre_body)
    LOG.add("PRECREATE:", r1.status_code, r1.text)
    r1.raise_for_status()


    data = r1.json().get("data", {}) if r1.text else {}
    upload_id = data.get("upload_id")
    ktx_upload_id = data.get("ktx_upload_id")
    pvr_upload_id = data.get("pvr_upload_id")


    mime, _ = mimetypes.guess_type(file_name)
    if not mime:
        mime = "application/octet-stream"


    with open(file_path, "rb") as f:
        files = {"file": (file_name, f, mime)}
        print(f"files: {file_name}, {f}, {mime}")
        form = {
            "upload_id": upload_id or "",
            "ktx_upload_id": ktx_upload_id or "",
            "pvr_upload_id": pvr_upload_id or "",
        }
        r2 = requests.post(f"{base_url}/superfile", headers={"Authorization": f"Bearer {token}"}, data=form, files=files)
    LOG.add("SUPERFILE:", r2.status_code, r2.text)
    r2.raise_for_status()


    if upload_id:
        r3 = requests.get(
            f"{base_url}/upload_status",
            headers={"Authorization": f"Bearer {token}"},
            params={"upload_id": upload_id},
        )
        LOG.add("UPLOAD STATUS:", r3.status_code, r3.text)


# --------------------------------------------------------------------
# HELPERS
# --------------------------------------------------------------------
def safe_filename(name: str) -> str:
    p = pathlib.Path(name)
    stem = slugify(p.stem) or "file"
    ext = p.suffix.lower()
    return stem + ext


def strip_ext(name: str) -> str:
    return pathlib.Path(name).stem


def file_ext(name: str) -> str:
    return pathlib.Path(name).suffix.lower().lstrip(".")


def get_image_dimensions(image_path: str) -> Optional[Tuple[int, int]]:
    """Get image dimensions (width, height) from a file."""
    try:
        if PIL_AVAILABLE and Image is not None:
            with Image.open(image_path) as img:
                return img.size  # Returns (width, height)
        else:
            # Fallback: try to read basic info from file
            with open(image_path, "rb") as f:
                # For JPEG
                f.seek(0)
                if f.read(2) == b"\xFF\xD8":
                    f.seek(0)
                    # Simple JPEG dimension reading (not perfect but works for most)
                    f.seek(2)
                    while True:
                        marker = f.read(2)
                        if not marker or len(marker) < 2:
                            break
                        if marker[0] == 0xFF and marker[1] in (0xC0, 0xC1, 0xC2, 0xC3):
                            f.read(3)  # Skip length and precision
                            h = int.from_bytes(f.read(2), "big")
                            w = int.from_bytes(f.read(2), "big")
                            return (w, h)
                        elif marker[0] == 0xFF:
                            length = int.from_bytes(f.read(2), "big")
                            f.read(length - 2)
                        else:
                            break
                # For PNG
                f.seek(0)
                if f.read(8) == b"\x89PNG\r\n\x1a\n":
                    f.read(8)  # Skip IHDR chunk header
                    w = int.from_bytes(f.read(4), "big")
                    h = int.from_bytes(f.read(4), "big")
                    return (w, h)
        return None
    except Exception as e:
        LOG.add(f"Error getting image dimensions: {e}")
        return None


def infer_folder_name(url: str) -> Optional[str]:
    if not url.startswith(FF_BASE):
        return None
    segs = [s for s in urlparse(url).path.split("/") if s]
    if segs and segs[0] == "common":
        segs = segs[1:]
    if len(segs) <= 1:
        return None
    return "/" + "/".join(segs[:-1])


# For extension matching: if source ends with ".ff_extend", expect jpg in assets.
EXT_EXPECT_MAP = {"ff_extend": ["jpg"]}


# Filename to expected size mapping (width x height)
FILENAME_SIZE_MAP = {
    "overview.ff_extend": (1400, 700),
    "splash.ff_extend": (880, 520),
    "event.ff_extend": (338, 396),
    "event.png": (466, 676),
    "mallsmall.png": (252, 256),
    "mallbig.png": (512, 182),
    "slidebanner.png": (256, 107),
    "icon.png": (100, 100),
    "titlemall.png": (660, 108),
    "bgmall.ff_extend": (1500, 750),
    "title.png": (659, 179),
    "background.ff_extend": (1400, 700),
    "spinbgid_ind.png": (833, 691),
    "tabid_ind.ff_extend": (180, 80),
    "lobbybgid_ind.ff_extend": (1500, 750),
    "enterid_ind.png": (508, 478),
    "bannerid_ind.png": (908, 605),
}


# Special handling for titleid_ind.png - check column A for token
# Token Ring (492x92), Faded Wheel (280x46), Moco Store (435x53), Magic Box (492x70)
TITLEID_SIZES = {
    "Token Ring": (492, 92),
    "Token Wheel": (492, 92),
    "Faded Wheel": (280, 46),
    "Moco Store": (435, 53),
    "Magic Box": (492, 70),
}


# --------------------------------------------------------------------
# NOTION
# --------------------------------------------------------------------
NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"
notion_token_hdr = {
    "Authorization": f"Bearer {notion_token}",
    "Notion-Version": NOTION_VERSION,
    "Accept": "application/json",
}
notion_sess = requests.Session()
notion_sess.headers.update(notion_token_hdr)
download_sess = requests.Session()
download_sess.headers.update({"Accept": "*/*"})


from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode


def clean_notion_url(u: str) -> str:
    p = urlsplit(u)
    # remove noisy params like 'source' and (optionally) 'v' if you want to ignore DB view IDs
    kept = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k not in ("source", "source=copy_link")]
    # If you also want to ignore database view IDs, drop 'v' too:
    kept = [(k, v) for k, v in kept if k != "v"]
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode(kept, doseq=True), ""))


def extract_page_id_from_url(url: str) -> Optional[str]:
    p = urlsplit(clean_notion_url(url))  # <— use cleaned URL (no query noise)
    path = p.path or ""
    m = re.search(r'([0-9a-fA-F]{32})(?=$|/)', path)
    if not m:
        return None
    h = m.group(1).lower()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"






def notion_list_children(block_id: str) -> List[dict]:
    block_id = block_id.strip().strip('"').replace('\\', '')
    # Keep only hex digits
    block_id = re.sub(r'[^0-9a-fA-F]', '', block_id)


    results = []
    cursor = None
    while True:
        params = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        url = f"{NOTION_API_BASE}/blocks/{block_id}/children"
        r = notion_sess.get(url, params=params, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"Notion error {r.status_code}: {r.text}")
        data = r.json()
        page_results = data.get("results", [])
        results.extend(page_results)
        if data.get("has_more"):
            cursor = data.get("next_cursor")
        else:
            break
    return results


def notion_collect_asset_blocks_recursive(block_id: str, depth: int = 0) -> List[Tuple[str, str]]:
    """
    Recursively collect assets from a block and all its children.
    """
    assets = []
    max_depth = 10  # Prevent infinite recursion
   
    if depth > max_depth:
        return assets
   
    children = notion_list_children(block_id)
   
    for idx, blk in enumerate(children):
        t = blk.get("type")
        blk_id = blk.get("id")
        data = blk.get(t, {}) if t else {}
        url = None
       
        # Check for direct asset types
        if t in ("image", "file", "pdf", "video"):
            src_type = data.get("type")
            src_data = data.get(src_type, {}) or {}
            url = src_data.get("url")
        elif t == "bookmark":
            url = data.get("url")
       
        # Check for embedded images in rich text or other block types
        if not url and t in ("paragraph", "heading_1", "heading_2", "heading_3", "callout", "quote", "bulleted_list_item", "numbered_list_item", "to_do"):
            # Check for images in rich text annotations
            rich_text = data.get("rich_text", [])
            for rt_idx, rt in enumerate(rich_text):
                annotations = rt.get("annotations", {})
                if annotations.get("type") == "image" or "image" in str(rt).lower():
                    # Check for mention types that might be images
                    pass
                mention = rt.get("mention")
                if mention and mention.get("type") == "file":
                    file_data = mention.get("file", {})
                    url = file_data.get("url")
       
        # Check for images in columns
        if t == "column_list":
            pass
            # Column lists contain column blocks, which contain the actual content
            # We'll recurse into children which should handle columns
       
        # Add asset if URL found
        if url:
            name = safe_filename(os.path.basename(urlparse(url).path))
            assets.append((url, name))


       
        # Recursively search children of this block (for columns, callouts, etc.)
        if blk_id and t not in ("image", "file", "pdf", "video"):  # Don't recurse into assets themselves
            nested_assets = notion_collect_asset_blocks_recursive(blk_id, depth + 1)
            assets.extend(nested_assets)
   
    return assets


def notion_collect_asset_blocks(block_id: str) -> List[Tuple[str, str]]:
    """
    Collect assets from Notion page, including nested blocks.
    """


    assets = notion_collect_asset_blocks_recursive(block_id, depth=0)
   
    # Debug: print all block types found at top level
    children = notion_list_children(block_id)
    block_types = {}
    for blk in children:
        t = blk.get("type", "unknown")
        block_types[t] = block_types.get(t, 0) + 1


   


    return assets


# --------------------------------------------------------------------
# GOOGLE DRIVE HELPERS
# --------------------------------------------------------------------
def is_google_drive_url(url: str) -> bool:
    return bool(url) and ("drive.google.com" in url.lower())


def extract_google_drive_id(url: str) -> Optional[Tuple[str, str]]:
    """
    Returns (id, kind) where kind in {'file','folder'}.
    """
    if not url:
        return None
    m = re.search(r'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)', url)
    if m: return (m.group(1), "file")
    m = re.search(r'drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)', url)
    if m: return (m.group(1), "file")
    m = re.search(r'drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)', url)
    if m: return (m.group(1), "folder")
    m = re.search(r'drive\.google\.com/drive/u/\d+/folders/([a-zA-Z0-9_-]+)', url)
    if m: return (m.group(1), "folder")
    return None


def get_drive_service():
    if not GOOGLE_DRIVE_AVAILABLE:
        raise RuntimeError("google-api-python-client is required. pip install google-api-python-client")
    info = json.loads(sheet_credentials)
    scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    creds = Credentials.from_service_account_info(info, scopes=scopes)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def google_drive_collect_assets(drive_url: str) -> List[Tuple[str, str]]:
    """
    Return [(download_url, filename)] for JPG/PNG in a Drive file or folder URL.
    download_url is a googleapis media URL recognized by download_to_file().
    """
    out: List[Tuple[str, str]] = []
    try:


        id_info = extract_google_drive_id(drive_url)
        if not id_info:


            LOG.add(f"Drive: cannot parse ID from {drive_url}")
            return out
        file_id, kind = id_info


        svc = get_drive_service()


        if kind == "folder":
            # First, try to list ALL files to see what's in the folder




            try:
                all_files_resp = svc.files().list(
                    q=f"'{file_id}' in parents and trashed=false",
                    fields="files(id,name,mimeType)",
                    pageSize=100
                ).execute()
                all_files = all_files_resp.get("files", [])
                pass
            except Exception as e:
                pass
                traceback.print_exc()
           
            # Now query for images only
            q = f"'{file_id}' in parents and trashed=false and (mimeType='image/jpeg' or mimeType='image/png')"




            page_token = None
            while True:
                try:
                    resp = svc.files().list(
                        q=q,
                        fields="nextPageToken, files(id,name,mimeType)",
                        pageToken=page_token,
                    ).execute()
                    files = resp.get("files", [])
                    # print(f"[DEBUG] Found {len(files)} image files matching query")
                    for f in files:
                        dl = f"https://www.googleapis.com/drive/v3/files/{f['id']}?alt=media"
                        out.append((dl, f["name"]))




                    page_token = resp.get("nextPageToken")
                    if not page_token:
                        break
                except Exception as e:




                    traceback.print_exc()
                    break
        else:  # single file




            meta = svc.files().get(fileId=file_id, fields="id,name,mimeType,trashed").execute()




            if meta.get("trashed"):




                return out
            if meta.get("mimeType") in ("image/jpeg", "image/png"):
                dl = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
                out.append((dl, meta.get("name", "image")))




            else:
                pass


    except Exception as e:
        pass


        traceback.print_exc()
        LOG.add("Drive collect error:", e)




    return out


# --------------------------------------------------------------------
# DOWNLOAD (+ optional resize)
# --------------------------------------------------------------------
def http_get_with_retries(url: str, stream=False, headers=None):
    for _ in range(3):
        try:
            r = download_sess.get(url, timeout=60, stream=stream, headers=headers)
            if r.status_code in (200, 206):
                return r
        except requests.RequestException:
            time.sleep(1)
    return None


def download_to_file(url: str, dest_path: str) -> bool:
    """
    Drive-aware downloader:
      - If URL is a googleapis Drive media link, use MediaIoBaseDownload.
      - Else plain GET.
      - Validates bytes are actual images (PNG/JPEG).
    """
    # Drive media link?
    m = re.search(r"googleapis\.com/drive/v3/files/([^/?]+)\?alt=media", url)
    if m and GOOGLE_DRIVE_AVAILABLE and MediaIoBaseDownload is not None:
        file_id = m.group(1)
        try:
            svc = get_drive_service()
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            request = svc.files().get_media(fileId=file_id)
            with open(dest_path, "wb") as fh:
                downloader = MediaIoBaseDownload(fh, request, chunksize=1 * 1024 * 1024)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
            # Validate image
            return _validate_image_file(dest_path)
        except Exception as e:
            LOG.add(f"Drive download failed: {e}")
            return False


    # Fallback (or non-Drive URL): plain GET
    r = http_get_with_retries(url, stream=True, headers=None)
    if not r:
        LOG.add("Failed to download", url)
        return False


    ctype = (r.headers.get("Content-Type") or "").lower()
    if ("text/html" in ctype) or ("application/json" in ctype) or ("text/plain" in ctype):
        LOG.add(f"Non-image content ({ctype}) from {url}")
        return False


    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(8192):
            if chunk:
                f.write(chunk)


    return _validate_image_file(dest_path)


def _validate_image_file(path: str) -> bool:
    try:
        if PIL_AVAILABLE and Image is not None:
            with Image.open(path) as img:
                img.verify()
        else:
            with open(path, "rb") as f:
                sig = f.read(8)
                if not (sig.startswith(b"\xFF\xD8") or sig.startswith(b"\x89PNG\r\n\x1a\n")):
                    LOG.add(f"Downloaded file is not PNG/JPEG: {path}")
                    return False
        return True
    except Exception as e:
        LOG.add(f"Downloaded file is not a valid image: {e}")
        return False


def ensure_true_jfif_jpeg(path: str) -> bool:
    """Return True if file looks like a baseline JFIF JPEG (SOI + 'JFIF' + EOI)."""
    try:
        with open(path, "rb") as f:
            head = f.read(40)
            if len(head) < 20 or head[:2] != b"\xFF\xD8":
                return False
            if b"JFIF\x00" not in head:
                return False
            f.seek(-2, os.SEEK_END)
            return f.read(2) == b"\xFF\xD9"
    except Exception:
        return False


def normalize_to_baseline_jpeg(src_path: str, dst_path: Optional[str] = None, quality: int = 85) -> bool:
    try:
        if dst_path is None:
            dst_path = src_path
        with Image.open(src_path) as im:
            if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
                bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
                bg.paste(im, mask=im.split()[-1] if im.mode != "P" else None)
                im = bg.convert("RGB")
            else:
                im = im.convert("RGB")


            buf = BytesIO()
            im.save(
                buf,
                format="JPEG",
                quality=quality,
                optimize=True,
                progressive=False,
                subsampling="4:2:0"
            )
            with open(dst_path, "wb") as f:
                f.write(buf.getvalue())
        return ensure_true_jfif_jpeg(dst_path)
    except Exception as e:
        LOG.add("normalize_to_baseline_jpeg error:", e)
        return False


from typing import Optional, Tuple


def cap_max_dimension_under(
    image_path: str,
    output_path: Optional[str] = None,
    max_side: int = 2047,
    force_jpeg: bool = False,
    quality: int = 85,
) -> Tuple[bool, bool]:
    try:
        if output_path is None:
            output_path = image_path


        with Image.open(image_path) as im:
            w, h = im.size
            need_resize = max(w, h) >= (max_side + 1)


            if not need_resize and not force_jpeg:
                return True, False


            if need_resize:
                if w >= h:
                    new_w = max_side
                    new_h = max(1, int(h * (max_side / float(w))))
                else:
                    new_h = max_side
                    new_w = max(1, int(w * (max_side / float(h))))
                im = im.resize((new_w, new_h), Image.LANCZOS)


            buf = BytesIO()
            if force_jpeg:
                im = im.convert("RGB")
                im.save(buf, format="JPEG", quality=quality, optimize=True, progressive=False, subsampling="4:2:0")
            else:
                fmt = (im.format or "PNG").upper()
                if fmt in ("JPG", "JPEG"):
                    im = im.convert("RGB")
                    im.save(buf, format="JPEG", quality=quality, optimize=True, progressive=False, subsampling="4:2:0")
                elif fmt == "PNG":
                    im.save(buf, format="PNG", optimize=True, compress_level=9)
                else:
                    im.save(buf, format="PNG", optimize=True, compress_level=9)


            with open(output_path, "wb") as f:
                f.write(buf.getvalue())


            return True, need_resize
    except Exception as e:
        LOG.add("cap_max_dimension_under error:", e)
        return (False, False)


def compress_image_under_limit(image_path, output_path=None, max_bytes=600*1024, quality=85, force_jpeg=False):
    try:
        if output_path is None:
            output_path = image_path


        if force_jpeg:
            ok = normalize_to_baseline_jpeg(image_path, output_path, quality=quality)
            if not ok:
                return False, False
            base_img = Image.open(output_path)
        else:
            base_img = Image.open(image_path)


        w, h = base_img.size
        scale = 1.0


        while True:
            new_w, new_h = max(1, int(w*scale)), max(1, int(h*scale))
            im2 = base_img.resize((new_w, new_h), Image.LANCZOS)


            buf = BytesIO()
            if force_jpeg:
                im2 = im2.convert("RGB")
                im2.save(buf, format="JPEG", quality=quality, optimize=True, progressive=False, subsampling="4:2:0")
            else:
                fmt = (base_img.format or "JPEG").upper()
                if fmt in ("JPG", "JPEG"):
                    im2 = im2.convert("RGB")
                    im2.save(buf, format="JPEG", quality=quality, optimize=True, progressive=False, subsampling="4:2:0")
                elif fmt == "PNG":
                    im2.save(buf, format="PNG", optimize=True, compress_level=9)
                else:
                    return False, False


            size_now = buf.tell()
            if size_now <= max_bytes or scale < 0.12:
                with open(output_path, "wb") as f:
                    f.write(buf.getvalue())
                return True, (scale < 1.0)
            scale *= 0.85
    except Exception as e:
        LOG.add("Compress error:", e)
        return False, False


# --------------------------------------------------------------------
# GOOGLE SHEETS
# --------------------------------------------------------------------
SECTION_NAMES = {
    "Overview",
    "NEW Shopping mall",
    "Shop",
    "Slide banner",
    "Slide Banner",
    "Gacha",
    "Luck Royale",
    "Icon/Loading Screen/Background",
    "Background",
    "Icon",
    "Event",
    "Events",
    "Esports",
    "CRAFTLAND",
}


def normalize_dash(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"[\u2013\u2014\u2212]", "-", text).strip()


def is_week_range_label(text: str) -> bool:
    return bool(re.search(r"\d{1,2}\s*-\s*\d{1,2}", normalize_dash(text)))


def resolve_section_sub_week(col_a: str, col_b: str, fallback: str = "") -> Optional[str]:
    col_a = (col_a or "").strip()
    col_b = (col_b or "").strip()
    if col_a not in SECTION_NAMES:
        return None
    if col_b and is_week_range_label(col_b):
        return col_b
    if fallback:
        return fallback
    return None


def sub_week_matches(current: str, target_norm: str) -> bool:
    if not target_norm:
        return True
    return normalize_dash(current) == target_norm


def get_worksheet(sheet_title: str, tab_name: Optional[str] = None):
    info = json.loads(sheet_credentials)
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_info(info, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open(sheet_title)
    if tab_name:
        ws = sh.worksheet(tab_name)
    else:
        meta = sh.fetch_sheet_metadata()
        visible = [s for s in meta["sheets"] if not s["properties"].get("hidden", False)]
        rightmost = visible[-1]
        ws = sh.worksheet(rightmost["properties"]["title"])
    LOG.add(f"TOOL_F_TAB: {ws.title}")
    return ws


def get_rightmost_worksheet(sheet_title: str):
    return get_worksheet(sheet_title, None)


def header_index_map(header_row: List[str]) -> Dict[str, int]:
    return {h.strip().lower(): i for i, h in enumerate(header_row)}


def pick_sheet_filename(row: List[str], header_idx: Dict[str, int], ff_url: str) -> str:
    candidates = [
        "filename", "file name", "cdn filename", "cdn file name",
        "target filename", "target file name", "upload filename",
    ]
    for key in candidates:
        i = header_idx.get(key)
        if i is not None and i < len(row) and row[i].strip():
            return row[i].strip()
    return os.path.basename(urlparse(ff_url).path)


# --------------------------------------------------------------------
# MAIN LOGIC
# --------------------------------------------------------------------
def find_and_upload_matching_asset(ff_url: str, notion_url: str, sheet_filename: str, column_a_value: str = "") -> Tuple[bool, str, bool]:
    """
    Returns (success, message, resized)
    column_a_value: Value from column A (for titleid_ind.png special case)
    """
   
    if not ff_url or not notion_url or not ff_url.startswith(FF_BASE):
        return False, "Skip row: missing/invalid URLs", False


    # Extract expected filename from column B URL (for size mapping)
    path = urlparse(ff_url).path
    path_parts = [p for p in path.split("/") if p]
    original_filename = path_parts[-1] if path_parts else None  # preserve original case for upload
    expected_filename = original_filename.lower() if original_filename else None  # lowercase for matching
   
    if not expected_filename:
        return False, "Skip row: cannot extract filename from FF URL", False


    folder_name = infer_folder_name(ff_url)
    if not folder_name:
        return False, "Skip row: cannot parse folder", False


    # Get expected size(s) from mapping
    expected_size = None
    expected_sizes: List[Tuple[int, int]] = []
    overview_exact_target: Optional[str] = None
    if "titleid_ind.png" in expected_filename and column_a_value:
        # Special case: check column A for token.
        # Column A may contain extra suffix text, e.g.:
        # "Token Ring - Booyah Pass Card S39 (803000000)".
        col_a_text = column_a_value.strip()
        key_candidate = col_a_text.split(" - ", 1)[0].strip()
        expected_size = TITLEID_SIZES.get(key_candidate)


        if expected_size is None:
            col_a_lower = col_a_text.lower()
            for title_key, title_size in TITLEID_SIZES.items():
                print(f"Found title: {title_key}")
                print(f"Col A: {col_a_lower}")
                if title_key.lower() in col_a_lower:
                    expected_size = title_size
                    print(f"Expected size: {expected_size}")
                    break
    else:
        # Direct lookup first
        expected_size = FILENAME_SIZE_MAP.get(expected_filename)


        # Fallback for dynamic names ending with *_ind.<ext>:
        # deeleetfhdaewom_190126_tabid_ind.ff_extend -> tabid_ind.ff_extend
        if expected_size is None and (expected_filename.endswith("id_ind.ff_extend") or expected_filename.endswith("id_ind.png")):
            parts = expected_filename.rsplit(".", 1)
            if len(parts) == 2:
                stem, ext = parts[0], parts[1]
                if stem.endswith("_ind"):
                    stem_wo_ind = stem[:-4]  # strip "_ind" from right
                    last_token = stem_wo_ind.split("_")[-1] if stem_wo_ind else ""
                    if last_token:
                        fallback_key = f"{last_token}_ind.{ext}"
                        expected_size = FILENAME_SIZE_MAP.get(fallback_key)


    if expected_size is not None:
        expected_sizes = [expected_size]
    else:
        # For overviewN.ff_extend, match exact asset filename from Notion/Drive.
        # Example: overview12.ff_extend -> overview12.jpg
        m_overview = re.match(r"^overview(\d+)\.ff_extend$", expected_filename)
        if m_overview:
            overview_exact_target = f"overview{m_overview.group(1)}.jpg"


    # Determine expected extension (handle .ff_extend -> .jpg conversion)
    expected_ext = file_ext(expected_filename)
    if expected_ext == "ff_extend":
        expected_exts = ["jpg", "jpeg"]  # .ff_extend files should be jpg in assets
    else:
        expected_exts = [expected_ext]


    # Collect assets: Google Drive or Notion
    assets: List[Tuple[str, str]] = []
   
    if is_google_drive_url(notion_url):
        LOG.add(f"Detected Google Drive link: {notion_url}")
        assets = google_drive_collect_assets(notion_url)
        if not assets:
            return False, "No image assets (jpg/png) found in Google Drive link", False
    else:
        page_id = extract_page_id_from_url(notion_url)
        if not page_id:
            return False, "Invalid Notion page URL", False
        assets = notion_collect_asset_blocks(page_id)






    # Print all collected file names with extensions
    print(f"\nCollected {len(assets)} asset(s):")
    for url, name in assets:
        ext = file_ext(name)
        print(f"  - {name} (extension: .{ext if ext else 'no extension'})")


    # Match by exact filename first, then fallback to size.
    # For overviewN (overview1, overview2, ...), keep name-only behavior.
    exact_match: Optional[Tuple[str, str]] = None


    if overview_exact_target is not None:
        for url, name in assets:
            if os.path.basename(name).lower() == overview_exact_target:
                exact_match = (url, name)
                break
        if not exact_match:
            return False, f"No asset found with exact name '{overview_exact_target}' in Notion/Drive assets", False
    else:
        # 1) Name-first matching
        if expected_filename.endswith(".ff_extend"):
            base_noext = Path(expected_filename).stem
            expected_name_candidates = [f"{base_noext}.jpg", f"{base_noext}.jpeg"]
        else:
            expected_name_candidates = [expected_filename]


        for url, name in assets:
            nm = os.path.basename(name).lower()
            if nm in expected_name_candidates:
                exact_match = (url, name)
                break


        # 2) Size fallback (only if name not found)
        if exact_match is None:
            if not expected_sizes:
                return False, f"No asset found by name [{', '.join(expected_name_candidates)}] and no size mapping found for '{expected_filename}'", False


            # Check dimensions of all assets (ignore filename)
            temp_dir = os.path.join(DOWNLOAD_BASE, "_temp_check")
            os.makedirs(temp_dir, exist_ok=True)


            for url, name in assets:
                nm_ext = file_ext(name)


                # Only check assets with expected extension
                if nm_ext not in expected_exts:
                    continue


                try:
                    temp_path = os.path.join(temp_dir, f"check_{hash(url)}.{nm_ext}")
                    if download_to_file(url, temp_path):
                        dims = get_image_dimensions(temp_path)
                        if dims:
                            if dims in expected_sizes:
                                exact_match = (url, name)
                                # Clean up temp file
                                try:
                                    os.remove(temp_path)
                                except:
                                    pass
                                break
                            else:
                                expected_sizes_txt = " or ".join([f"{w}x{h}" for (w, h) in expected_sizes])
                                print(f"[DEBUG] ✗ Size mismatch for '{name}': got {dims[0]}x{dims[1]}, expected {expected_sizes_txt}")
                except Exception:
                    pass
                finally:
                    # Clean up temp file
                    try:
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                    except:
                        pass


            if not exact_match:
                expected_sizes_txt = " or ".join([f"{w}x{h}" for (w, h) in expected_sizes])
                return False, f"No asset found by name [{', '.join(expected_name_candidates)}] and no size match {expected_sizes_txt} with extension [{', '.join(expected_exts)}]", False


    # Download pipeline
    url, notion_name = exact_match
    out_dir = os.path.join(DOWNLOAD_BASE, folder_name.strip("/").replace("/", os.sep))
    os.makedirs(out_dir, exist_ok=True)


    local_name = safe_filename(notion_name)
    out_path = os.path.join(out_dir, local_name)
    LOG.add(f"Matched asset '{notion_name}' for expected filename '{expected_filename}': {out_path}")


    if not download_to_file(url, out_path):
        return False, "Download failed", False


    # Check if expected filename is .ff_extend (for conversion to jpg)
    is_ff_extend = expected_filename.lower().endswith(".ff_extend")


    if is_ff_extend:
        ok_norm = normalize_to_baseline_jpeg(out_path, out_path, quality=85)
        if not ok_norm:
            return False, "Failed to normalize image to baseline JPEG", False


    ok_dim, dim_resized = cap_max_dimension_under(
        out_path,
        out_path,
        max_side=2047,
        force_jpeg=is_ff_extend,
        quality=85
    )
    if not ok_dim:
        return False, "Failed to downscale to < 2048px", False


    resized = dim_resized
    size = os.path.getsize(out_path)
    if size > MAX_SIZE_BYTES:
        ok, resized2 = compress_image_under_limit(
            out_path,
            max_bytes=MAX_SIZE_BYTES,
            quality=85,
            force_jpeg=is_ff_extend
        )
        resized = resized or resized2
        if not ok:
            return False, f"File exceeds 600 KB and resize failed (size={size} bytes)", False
        size = os.path.getsize(out_path)
        if size > MAX_SIZE_BYTES:
            return False, f"File exceeds 600 KB after resize attempt (size={size} bytes)", resized


    if is_ff_extend and not ensure_true_jfif_jpeg(out_path):
        return False, "Normalized file is not a baseline JFIF JPEG", resized


    print(f"sheet_filename: {sheet_filename}")
    print(f"expected_filename: {expected_filename}")


    # Use original (case-preserved) filename from column B for upload name
    # Convert .ff_extend to .jpg if needed
    if original_filename.lower().endswith(".ff_extend"):
        base_noext = Path(original_filename).stem
        upload_name = f"{base_noext}.jpg"
    else:
        # Use the original filename as-is (preserving case)
        upload_name = original_filename


    print(f"upload_name: {upload_name}")
    upload_file(folder_name, upload_name, out_path, token)


    cdn_link = f"{FF_BASE}common{folder_name}/{upload_name}".replace("//", "/").replace(":/", "://")
    msg = f"Uploaded '{upload_name}' (matched '{notion_name}') |  Link: {cdn_link}"
    return True, msg, resized


def main():
    if not token:
        raise SystemExit("CDN_API_TOKEN is required")
    if not notion_token:
        raise SystemExit("NOTION_API_TOKEN is required")
    if not TOOL_F_SHEET_TAB:
        raise SystemExit("TOOL_F_SHEET_TAB is required")
    if not TOOL_F_SUB_WEEK:
        raise SystemExit("TOOL_F_SUB_WEEK is required")

    target_sub_week_norm = normalize_dash(TOOL_F_SUB_WEEK)

    start_ts = time.time()
    per_row_msgs = []
    try:
        ws = get_worksheet(SHEET_TITLE, TOOL_F_SHEET_TAB)
        LOG.add(f"TOOL_F_SUB_WEEK: {TOOL_F_SUB_WEEK}")
        values = ws.get_all_values()
        if not values:
            LOG.add("Sheet is empty")
            return


        header = values[0]
        hidx = header_index_map(header)
        LOG.add("Header columns:", len(header))


        COL_B = 1   # FF URL
        COL_J = 9   # Notion/Drive URL
        COL_L = 11  # Checkbox “CDN Uploaded”


        matched = 0
        failed = 0
        skipped = 0
        last_non_empty_col_a = ""
        current_sub_week = ""
        for r_idx, row in enumerate(values[1:], start=2):
            col_a = row[0].strip() if len(row) > 0 and row[0] else ""
            col_b = row[1].strip() if len(row) > 1 and row[1] else ""

            section_label = resolve_section_sub_week(col_a, col_b, TOOL_F_SUB_WEEK)
            if section_label is not None:
                current_sub_week = section_label
                continue

            if not sub_week_matches(current_sub_week, target_sub_week_norm):
                continue

            label = row[0].strip() if len(row) > 0 and row[0].strip() else f"Row {r_idx}"
            raw_col_a = row[0].strip() if len(row) > 0 else ""
            if raw_col_a:
                last_non_empty_col_a = raw_col_a


            if len(row) <= COL_B or not str(row[COL_B]).strip().startswith(FF_BASE):
                continue


            if len(row) > COL_L and str(row[COL_L]).strip().lower() in ("true", "yes", "1", "y"):
                LOG.add(f"TOOL_F_SKIPPED: {label} | col L already checked")
                skipped += 1
                continue


            ff_url = row[COL_B].strip()
            notion_url = (row[COL_J].strip() if len(row) > COL_J else "")
            notion_url = clean_notion_url(notion_url)
           
            # Get column A value with carry-down fallback for gacha + id_ind rows.
            ff_path_lower = urlparse(ff_url).path.lower()
            ff_name_lower = os.path.basename(ff_path_lower)
            is_gacha_id_ind = ("gacha" in ff_path_lower) and ("id_ind" in ff_name_lower)


            if raw_col_a:
                column_a_value = raw_col_a
            elif is_gacha_id_ind:
                # For blank A on gacha/id_ind rows, inherit nearest previous non-blank A.
                column_a_value = last_non_empty_col_a
            else:
                column_a_value = ""


            sheet_fname = pick_sheet_filename(row, hidx, ff_url)


            LOG.add(f"\n{label}: {ff_url} | sheet_fname='{sheet_fname}'")
            try:
                ok, msg, resized = find_and_upload_matching_asset(ff_url, notion_url, sheet_fname, column_a_value)
                if msg == "Skip row: missing/invalid URLs":
                    continue
                if ok:
                    matched += 1
                    per_row_msgs.append(f"✅ {label}: {msg}")
                    cdn_link = ""
                    if "Link:" in msg:
                        cdn_link = msg.split("Link:", 1)[1].strip()
                    LOG.add(f"TOOL_F_UPLOADED: {label} | {cdn_link or msg}")
                    try:
                        ws.update_cell(r_idx, COL_L + 1, True)
                    except Exception as e:
                        LOG.add(f"Warn: failed to set checkbox at L{r_idx}: {e}")
                else:
                    failed += 1
                    per_row_msgs.append(f"❌ {label}: {msg}")
                    LOG.add(f"TOOL_F_FAILED: {label} | {msg}")
            except Exception as e:
                failed += 1
                LOG.add("Error at", label, ":", str(e))
                per_row_msgs.append(f"❌ {label}: {e}")
                LOG.add(f"TOOL_F_FAILED: {label} | {e}")
       
        LOG.add(
            f"TOOL_F_SUMMARY: uploaded={matched} failed={failed} skipped={skipped}"
        )
        if per_row_msgs:
            # Filter out skip messages (safety check in case any slip through)
            filtered_msgs = [msg for msg in per_row_msgs if "Skip row: missing/invalid URLs" not in msg]
            if filtered_msgs:
                seatalk_notify("\n".join(filtered_msgs[:50]))
        else:
            pass
       


    except Exception:
        err = traceback.format_exc()
        tail = LOG.tail(20)
        seatalk_notify(f"[ERROR] Run crashed.\n--- error ---\n{err[-1500:]}\n--- logs ---\n{tail}")


if __name__ == "__main__":
    main()