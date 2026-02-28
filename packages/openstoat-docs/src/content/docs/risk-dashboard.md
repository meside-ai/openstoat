---
title: Risk Dashboard
description: Risk control metrics dashboard sourced from BigQuery decision logs
---

# Risk Dashboard

The Risk Dashboard displays risk control metrics for monitoring block rates, false positive rates, provider errors, and whitelist hits. Data is sourced from BigQuery decision logs.

## Metrics

| Metric | Description |
|--------|-------------|
| **Daily Block Count by Type** | Number of blocks per day, grouped by block type (e.g. fraud, policy, manual) |
| **False Positive Rate** | Percentage of blocks that were incorrectly flagged |
| **Provider Error Rate** | Percentage of decisions with provider errors |
| **Whitelist Hit Rate** | Percentage of decisions that hit the whitelist |

## Data Source

The dashboard can display:

- **Demo data**: Mock metrics for development and preview. No configuration required.
- **BigQuery (live)**: Real metrics from your BigQuery decision logs table when configured.

### BigQuery Schema

To use live data, your BigQuery table should have the following schema:

| Column | Type | Description |
|--------|------|-------------|
| `outcome` | STRING | `block` or `allow` |
| `block_type` | STRING | Type of block (e.g. fraud, policy, manual) |
| `is_false_positive` | BOOL | Whether the block was a false positive |
| `provider_error` | BOOL | Whether a provider error occurred |
| `whitelist_hit` | BOOL | Whether the decision hit the whitelist |
| `created_at` | TIMESTAMP | When the decision was made |

### Enabling Live Data

For a fully static deployment, the dashboard uses demo data by default. To connect to BigQuery:

1. Sync decision logs to BigQuery using `openstoat sync bq` (or your own ETL).
2. Add a server adapter (e.g. `@astrojs/node`) to the docs site.
3. Create an API route at `/api/risk-metrics.json` that queries BigQuery and returns the metrics. Set env vars: `OPENSTOAT_BQ_PROJECT`, `OPENSTOAT_BQ_DATASET`, `OPENSTOAT_BQ_TABLE`.
4. Update the dashboard to fetch from the API instead of using inline mock data.
