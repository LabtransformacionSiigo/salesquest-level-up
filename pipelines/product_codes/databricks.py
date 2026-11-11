"""Cliente mínimo (solo librería estándar) de las APIs de Databricks que usa el
pipeline: Apps, Workspace y OAuth M2M.

Credenciales por variables de entorno:
  DATABRICKS_HOST                                   (obligatoria)
  DATABRICKS_CLIENT_ID + DATABRICKS_CLIENT_SECRET   (service principal, recomendado)
  DATABRICKS_TOKEN                                  (token personal, alternativa)
"""
from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request


class DatabricksError(RuntimeError):
    pass


class NotFound(DatabricksError):
    pass


class Databricks:
    def __init__(self, host: str | None = None, token: str | None = None):
        host = host or os.environ.get("DATABRICKS_HOST", "")
        if not host:
            raise DatabricksError("Falta DATABRICKS_HOST")
        self.host = (host if host.startswith("http") else f"https://{host}").rstrip("/")
        self._token = token or os.environ.get("DATABRICKS_TOKEN") or self._oauth_token()

    def _oauth_token(self) -> str:
        cid, secret = os.environ.get("DATABRICKS_CLIENT_ID"), os.environ.get("DATABRICKS_CLIENT_SECRET")
        if not (cid and secret):
            raise DatabricksError("Faltan credenciales: DATABRICKS_TOKEN o DATABRICKS_CLIENT_ID/DATABRICKS_CLIENT_SECRET")
        req = urllib.request.Request(
            f"{self.host}/oidc/v1/token",
            data=b"grant_type=client_credentials&scope=all-apis",
            headers={
                "Authorization": "Basic " + base64.b64encode(f"{cid}:{secret}".encode()).decode(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        return json.loads(self._send(req))["access_token"]

    @staticmethod
    def _send(req: urllib.request.Request) -> bytes:
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")[:500]
            if e.code == 404 or "RESOURCE_DOES_NOT_EXIST" in body:
                raise NotFound(f"{req.get_method()} {req.full_url}: {body}") from None
            raise DatabricksError(f"{req.get_method()} {req.full_url} -> {e.code}: {body}") from None

    def _call(self, method: str, path: str, *, query: dict | None = None, body: dict | None = None) -> bytes:
        url = f"{self.host}{path}"
        if query:
            url += "?" + urllib.parse.urlencode(query)
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Authorization": f"Bearer {self._token}"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        return self._send(urllib.request.Request(url, data=data, headers=headers, method=method))

    def _json(self, method: str, path: str, **kw) -> dict:
        raw = self._call(method, path, **kw)
        return json.loads(raw) if raw else {}

    # ---- Apps ----
    def get_app(self, name: str) -> dict:
        return self._json("GET", f"/api/2.0/apps/{urllib.parse.quote(name)}")

    def deploy_app(self, name: str, source_code_path: str, timeout_s: int = 900) -> dict:
        dep = self._json(
            "POST",
            f"/api/2.0/apps/{urllib.parse.quote(name)}/deployments",
            body={"source_code_path": source_code_path, "mode": "SNAPSHOT"},
        )
        dep_id = dep["deployment_id"]
        deadline = time.monotonic() + timeout_s
        while True:
            state = (dep.get("status") or {}).get("state")
            if state == "SUCCEEDED":
                return dep
            if state in ("FAILED", "CANCELLED"):
                raise DatabricksError(f"Despliegue {dep_id} terminó en {state}: {(dep.get('status') or {}).get('message')}")
            if time.monotonic() > deadline:
                raise DatabricksError(f"Despliegue {dep_id} no terminó en {timeout_s}s (estado {state})")
            time.sleep(10)
            dep = self._json("GET", f"/api/2.0/apps/{urllib.parse.quote(name)}/deployments/{dep_id}")

    # ---- Workspace ----
    def read_json(self, path: str) -> dict | None:
        try:
            raw = self._call("GET", "/api/2.0/workspace/export", query={"path": path, "format": "AUTO", "direct_download": "true"})
        except NotFound:
            return None
        return json.loads(raw)

    def write_json(self, path: str, value) -> None:
        content = json.dumps(value, ensure_ascii=False).encode()
        self._json("POST", "/api/2.0/workspace/import", body={
            "path": path,
            "format": "AUTO",
            "overwrite": True,
            "content": base64.b64encode(content).decode(),
        })
