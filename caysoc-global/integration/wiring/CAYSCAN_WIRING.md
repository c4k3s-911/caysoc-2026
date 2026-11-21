# CayScaN Wiring Runbook (4)

1. Confirm CayScaN services on legacy host (dashboard/agents/sensors/DB) and auth model.
2. Create read-only API/DB/view for CSG aggregator (no write/exploit permissions).
3. Map CayScaN agents/alerts to CSG streams/projects (Isivikelo; exploit paths -> Ibhubesi gated).
4. Configure secrets on cx-serv1; test `GET /api/csg/dashboard/ops` and stream status.
5. Validate governance: ad-hoc/exploit actions require scope ref + human approval + evidence.
