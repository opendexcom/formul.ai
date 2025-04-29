from fastapi.testclient import TestClient
from app.main import app  # adjust if you named it differently

client = TestClient(app)

def test_create_item():
    response = client.post("/items/", json={"name": "foo", "price": 9.99})
    assert response.status_code == 200
    assert response.json() == {
        "item_received": {"name": "foo", "price": 9.99, "is_offer": False}
    }
