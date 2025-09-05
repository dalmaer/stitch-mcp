# Stitch MCP Debug (tiny repo)

Minimal, in-memory **MCP server** to demo how agents (e.g., Claude Desktop) can pull designs from "Stitch" via tools and resources.

## Features
- Tools: `list_projects`, `search_projects`, `get_project`, `get_screen`
- Resources: `stitch:project/{projectId}`, `stitch:project/{projectId}/screen/{screenId}`
- Sample projects: Travel App, Shop Checkout, Onboarding Flow, Parking App, Dog Fed?
- CLI fallback for quick debugging (no MCP client needed)

## Install
```bash
npm i
```

## Run as MCP server (stdio)
```bash
npm run dev
```
Attach from an MCP client (e.g., Claude Desktop). The server advertises the four tools and resource URIs.

## Use the built-in CLI (no MCP client)
```bash
npm run cli:list
npm run cli:search
npm run cli:project
npm run cli:screen
npm run cli:read
```

Or directly:
```bash
ts-node src/server.ts list_projects
ts-node src/server.ts search_projects "parking"
ts-node src/server.ts get_project p_dogfed
ts-node src/server.ts get_screen p_parking s1
ts-node src/server.ts read_resource "stitch:project/p_travel/screen/s1"
```

## File: `src/server.ts`
- JSON-RPC over stdio for MCP
- In-memory dataset with placeholder 1×1 PNG images
- Optional `resources` with `stitch:` URIs
- Trivial CLI for quick spot checks

## Example Script

What stitch projects do I have?

Show me the screenshot of the anagram solver

Can you generate a screen for a dog feeding tracking app?

