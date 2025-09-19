import backend.main as main_module
import pytest
from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_upload_200(monkeypatch, tmp_path):
    monkeypatch.setattr(main_module.rag, "MATS_DIR", str(tmp_path), raising=False)

    captured = {}

    def fake_add_material_and_index(*, title: str, filepath: str):
        # 受け取った引数をキャプチャ
        captured["title"] = title
        captured["filepath"] = filepath

        # move 済みの実ファイルが存在し、中身が一致することを確認
        with open(filepath, "rb") as f:
            assert f.read() == b"hello mp3? no, just text"

        # 成功レスポンスを返す
        return {"ok": True, "id": "mat-001", "title": title}

    monkeypatch.setattr(main_module.rag, "add_material_and_index", fake_add_material_and_index, raising=False)

    files = {"file": ("sample.txt", b"hello mp3? no, just text", "text/plain")}
    data = {"title": "My Material"}

    resp = client.post("/api/materials/upload", files=files, data=data)

    assert resp.status_code == 200


def test_upload_material_failure_returns_400(monkeypatch, tmp_path):
    """
    失敗ケース: rag.add_material_and_index が ok=False を返したら 400
    """
    monkeypatch.setattr(main_module.rag, "MATS_DIR", str(tmp_path), raising=False)

    def fake_fail(*, title: str, filepath: str):
        # ここでは中身検証などは省略して、失敗を返す
        return {"ok": False, "error": "embedding failed"}

    monkeypatch.setattr(main_module.rag, "add_material_and_index", fake_fail, raising=False)

    files = {"file": ("bad.pdf", b"%PDF-FAKE", "application/pdf")}
    # タイトル未指定 → 実装上は file.filename が使われる想定
    resp = client.post("/api/materials/upload", files=files)

    assert resp.status_code == 400
