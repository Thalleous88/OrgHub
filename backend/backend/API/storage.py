import mimetypes
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from django.conf import settings
from django.core.files.storage import Storage


class SupabaseStorage(Storage):
    redirect_downloads = True

    def __init__(self):
        self.bucket = settings.SUPABASE_STORAGE_BUCKET
        self.direct_url = settings.SUPABASE_STORAGE_DIRECT_URL.rstrip("/")
        self.function_url = settings.SUPABASE_STORAGE_FUNCTION_URL
        self.function_secret = settings.SUPABASE_STORAGE_FUNCTION_SECRET

    def _client(self, timeout):
        return httpx.Client(
            timeout=timeout,
            transport=httpx.HTTPTransport(retries=3),
        )

    def _direct_storage_url(self, signed_url):
        parsed = urlsplit(signed_url)
        return f"{self.direct_url}{parsed.path}?{parsed.query}"

    def _function_request(self, action, **payload):
        with self._client(timeout=30) as client:
            response = client.post(
                self.function_url,
                json={"action": action, **payload},
                headers={"x-orghub-storage-key": self.function_secret},
            )
        response.raise_for_status()
        return response.json()

    def _save(self, name, content):
        upload = self._function_request("create_upload", path=name)
        content_type = getattr(content, "content_type", None)
        if not content_type:
            content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"

        content.open()
        headers = {
            "content-type": content_type,
            "cache-control": "max-age=3600",
            "x-upsert": "false",
        }
        size = getattr(content, "size", None)
        if size is not None:
            headers["content-length"] = str(size)

        with self._client(timeout=120) as client:
            response = client.put(
                self._direct_storage_url(upload["signed_url"]),
                content=content.chunks(chunk_size=1024 * 1024),
                headers=headers,
            )
        response.raise_for_status()
        return name

    def delete(self, name):
        if name:
            self._function_request("delete", path=name)

    def exists(self, name):
        return self._function_request("exists", path=name)["exists"]

    def size(self, name):
        return self._function_request("info", path=name)["size"]

    def url(self, name):
        signed_url = self._function_request(
            "create_download",
            path=name,
            filename=Path(name).name,
        )["signed_url"]
        return self._direct_storage_url(signed_url)
