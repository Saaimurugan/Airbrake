"""Check exact columns in projects_data via Lambda."""
import urllib.request, json

BASE = "https://l7xnpjosjvyrlx55dxrwdvx5g40okeyd.lambda-url.us-east-1.on.aws"

# Query information_schema via a Lambda endpoint that supports it
# Use the dashboard endpoint with a crafted query to reveal columns
print("Checking what columns exist in projects_data...\n")

# Required by app.py
REQUIRED = [
    "id", "row_type", "project_name", "created_at", "timestamp",
    "category", "is_live",
    "file_name", "success_count", "failure_count",
    "error", "error_detail", "error_hash", "error_status",
    "resolved_at", "reopened_at",
    "word_count", "file_type", "input_tokens", "output_tokens",
    "calculated_cost", "llm_usage",
    "solution", "created_by", "usage_count", "version",
    "confidence_score", "log_ref_id", "embedding",
    "email", "role", "oauth_provider", "oauth_subject",
]

# Test each column individually by trying a SELECT
def test_col(col):
    body = json.dumps({"project_name": "tandf_rubriq_processing"}).encode()
    # We'll use /api/debug/columns if deployed, otherwise fall back
    try:
        req = urllib.request.Request(
            f"{BASE}/api/debug/columns",
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
            return data.get("columns", [])
    except Exception:
        return None

cols = test_col("id")
if cols:
    print(f"Columns found in DB ({len(cols)}):")
    for c in cols:
        status = "✅" if c in REQUIRED else "  "
        print(f"  {status} {c}")
    print()
    missing = [c for c in REQUIRED if c not in cols]
    if missing:
        print(f"Still MISSING {len(missing)} columns:")
        for c in missing:
            print(f"  ❌ {c}")
        print("\nThe ALTER TABLE SQL may not have run yet.")
        print("Please run dsql_alter.sql in the AWS Console → Aurora DSQL → Query Editor")
    else:
        print("All required columns exist! ✅")
        print("The issue is that the deployed Lambda code is outdated.")
        print("Deploy the updated app.py to fix the 500 errors.")
else:
    print("Cannot check columns — /api/debug/columns not deployed yet.")
    print("The ALTER TABLE may not have run or the Lambda needs redeployment.")
    print()
    print("ERROR still present: 'column error_detail does not exist'")
    print()
    print("ACTION NEEDED: Run dsql_alter.sql in AWS Console → Aurora DSQL → Query Editor")
    print()
    print("SQL to run:")
    print("-" * 50)
    with open("dsql_alter.sql") as f:
        print(f.read())
