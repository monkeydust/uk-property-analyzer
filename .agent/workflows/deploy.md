---
description: How to deploy or redeploy to Hetzner (rightdata.uk)
---

# Deploy to Hetzner

**ALWAYS read `DEPLOYMENT.md` at the root of the project before doing anything deployment-related.** It contains critical server details, the correct redeploy sequence, and known quirks.

## Steps

1. Read `DEPLOYMENT.md` in full using the view_file tool.
2. SSH into the server: `ssh root@89.167.62.131`
3. Follow the "Deploying an Update" section exactly — in particular note the docker-compose v1 `ContainerConfig` bug workaround.
4. After deploying, verify the site is up: `curl -s https://www.rightdata.uk -o /dev/null -w "%{http_code}"`
