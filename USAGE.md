# Stitch MCP Server Usage

## Overview
A Model Context Protocol (MCP) server that exposes project data from a configurable filesystem directory.

## Configuration

### Projects Directory
The server reads project data from a directory containing project folders. Each project folder should have:
- `prompt.txt` - Project description
- Screen subdirectories with `code.html` and `screen.png` files

### Setting Projects Directory

#### 1. CLI Argument (for testing)
```bash
tsx src/server.ts --projects-dir /path/to/projects list_projects
tsx src/server.ts --projects-dir /path/to/projects get_project parked
```

#### 2. Environment Variable (for MCP server)
```bash
PROJECTS_DIR=/path/to/projects npm run dev
```

#### 3. MCP Configuration
Update your Claude Desktop MCP configuration:
```json
{
  "mcpServers": {
    "stitch-mcp": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/src/server.ts"],
      "env": {
        "PROJECTS_DIR": "/absolute/path/to/projects"
      }
    }
  }
}
```

## CLI Commands

- `list_projects` - List all projects
- `search_projects <query>` - Search projects by name/prompt
- `get_project <projectId>` - Get project details with screens
- `get_screen <projectId> <screenId>` - Get individual screen
- `read_resource <uri>` - Read MCP resource

## MCP Tools & Resources

### Tools
- `list_projects()` - List all projects
- `search_projects(query)` - Search projects
- `get_project(projectId)` - Get project details
- `get_screen(projectId, screenId)` - Get screen details

### Resources
- `stitch:project/{projectId}` - Project data
- `stitch:project/{projectId}/screen/{screenId}` - Screen data

## Default Behavior
If no projects directory is specified, the server defaults to `./projects` relative to the current working directory.