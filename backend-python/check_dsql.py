"""
DSQL Diagnostic Script — connects via Lambda debug endpoint.
Calls /api/debug/* endpoints on the live Lambda to check DB state.
No local AWS credentials needed.
"""

import urllib.request
import json

BASE = "https://l7xnpjosjvyrlx55dxrwdvx5g40okeyd.lambda-url.us-east-1.on.aws"

def get(path, body=None, method="GET"):
    url = f"{BASE}{path}"
    if body:
        data = json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
    else:
        req = urllib.request.Request(url, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            body = str(e)
        return e.code, body
    except Exception as ex:
        return 0, str(ex)

sep = "=" * 60
print(f"\n{sep}")
print("  DSQL Diagnostic via Lambda")
print(sep)

# 1. Health
print("\n[1] Health check")
code, data = get("/api/health")
print(f"  {'OK' if code == 200 else 'FAIL'} [{code}] {data}")

# 2. List projects (checks projects_data row_type='project')
print("\n[2] Projects list (projects_data row_type='project')")
code, data = get("/api/projects")
if code == 200:
    print(f"  OK [{code}] {len(data)} projects found")
    for p in data[:3]:
        print(f"    - {p.get('name')} ({p.get('category')})")
    if len(data) > 3:
        print(f"    ... and {len(data)-3} more")
else:
    print(f"  FAIL [{code}] {data}")

# 3. Debug tables
print("\n[3] Debug project tables")
code, data = get("/api/debug/project-tables")
if code == 200:
    print(f"  OK [{code}] {data.get('count')} projects in DB")
else:
    print(f"  FAIL [{code}] {data}")

# 4. Dashboard top-projects
print("\n[4] Dashboard top-projects")
code, data = get("/api/dashboard/top-projects")
if code == 200:
    projects = data.get("projects", [])
    print(f"  OK [{code}] {len(projects)} projects")
    for p in projects[:3]:
        print(f"    - {p.get('project_name')}: {p.get('total')}")
else:
    print(f"  FAIL [{code}] {data}")

# 5. Today errors (was failing)
print("\n[5] Dashboard today-errors")
code, data = get("/api/dashboard/today-errors")
if code == 200:
    errors = data.get("errors", [])
    print(f"  OK [{code}] {len(errors)} errors today")
else:
    print(f"  FAIL [{code}] {data}")

# 6. Breaks grouped (was failing)
print("\n[6] Breaks grouped")
code, data = get("/api/breaks/grouped")
if code == 200:
    print(f"  OK [{code}] total={data.get('total')} breaks")
else:
    print(f"  FAIL [{code}] {data}")

# 7. Project logs (was failing)
print("\n[7] Project logs for tandf_rubriq_processing")
code, data = get("/api/projects/tandf_rubriq_processing/logs")
if code == 200:
    print(f"  OK [{code}] total={data.get('total')} logs, exists={data.get('exists')}")
else:
    print(f"  FAIL [{code}] {data}")

# 8. Ingest test (was failing)
print("\n[8] Ingest success test")
code, data = get("/api/ingest/success", {
    "project_name": "tandf_rubriq_processing",
    "file_name": "diagnostic_test.pdf",
    "success_count": 1
}, method="POST")
if code in (200, 201):
    print(f"  OK [{code}] inserted id={data.get('id','?')}")
else:
    print(f"  FAIL [{code}] {data}")

# 9. Ingest error test
print("\n[9] Ingest error test")
code, data = get("/api/ingest/error", {
    "project_name": "tandf_rubriq_processing",
    "file_name": "diagnostic_test.pdf",
    "error": "Diagnostic test error from check_dsql.py"
}, method="POST")
if code in (200, 201):
    print(f"  OK [{code}] inserted id={data.get('id','?')}")
else:
    print(f"  FAIL [{code}] {data}")

print(f"\n{sep}")
print("  Done")
print(sep + "\n")
