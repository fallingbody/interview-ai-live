from uuid import uuid4


def test_report_fetch_not_found(client):
    response = client.get(f"/api/reports/{uuid4()}")
    assert response.status_code == 404
