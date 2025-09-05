/**
 * Stitch MCP Server (Filesystem Edition)
 * --------------------------------------
 * MCP server that reads project data from the projects/ directory
 * Tools:
 *   - list_projects()
 *   - search_projects(query)
 *   - get_project(projectId)
 *   - get_screen(projectId, screenId)
 * Resources:
 *   - stitch:project/{projectId}
 *   - stitch:project/{projectId}/screen/{screenId}
 *
 * Run as MCP server (stdio):
 *   npm run dev
 *
 * Debug CLI:
 *   tsx src/server.ts list_projects
 *   tsx src/server.ts search_projects "checkout"
 *   tsx src/server.ts get_project parked
 *   tsx src/server.ts get_screen parked untitled_screen_1
 *   tsx src/server.ts read_resource "stitch:project/parked"
 * 
 * With custom projects directory:
 *   tsx src/server.ts --projects-dir /path/to/projects list_projects
 *   tsx src/server.ts --projects-dir /path/to/projects get_project parked
 * 
 * Environment variable (for MCP server mode):
 *   BASE_DIR=/path/to/base npm run dev
 *   # or legacy:
 *   PROJECTS_DIR=/path/to/projects npm run dev
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

// ---------------------------
// Data Model
// ---------------------------

type ProjectId = string;

interface ScreenAsset {
  id: string;
  name: string;
  imageUrl?: string; // Path to screen.png
  code?: string;     // Contents of code.html
  updatedAt?: string; // ISO8601
}

interface ProjectSummary {
  id: ProjectId;
  name: string;
  prompt: string;
  screenCount: number;
  updatedAt?: string; // ISO8601
}

interface ProjectDetail {
  id: ProjectId;
  name: string;
  prompt: string;
  screens: ScreenAsset[];
  updatedAt?: string;
}

// ---------------------------
// Filesystem Readers
// ---------------------------

let BASE_DIR = process.cwd();
let PROJECTS_DIR = path.join(BASE_DIR, "projects");
let IMAGES_DIR = path.join(BASE_DIR, "images");

function setBaseDirectory(dir: string) {
  BASE_DIR = dir;
  PROJECTS_DIR = path.join(BASE_DIR, "projects");
  IMAGES_DIR = path.join(BASE_DIR, "images");
}

function setProjectsDirectory(dir: string) {
  PROJECTS_DIR = dir;
}

function setImagesDirectory(dir: string) {
  IMAGES_DIR = dir;
}

function readProjectsFromFilesystem(): ProjectDetail[] {
  const projects: ProjectDetail[] = [];
  
  if (!fs.existsSync(PROJECTS_DIR)) {
    return projects;
  }

  const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const projectDir of projectDirs) {
    try {
      const projectPath = path.join(PROJECTS_DIR, projectDir);
      const promptPath = path.join(projectPath, "prompt.txt");
      
      // Read prompt
      let prompt = "";
      if (fs.existsSync(promptPath)) {
        prompt = fs.readFileSync(promptPath, "utf-8").trim();
      }

      // Read screens
      const screens: ScreenAsset[] = [];
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const screenDir = entry.name;
          const screenPath = path.join(projectPath, screenDir);
          const codePath = path.join(screenPath, "code.html");
          const imagePath = path.join(screenPath, "screen.png");

          let code = "";
          if (fs.existsSync(codePath)) {
            code = fs.readFileSync(codePath, "utf-8");
          }

          const screen: ScreenAsset = {
            id: screenDir,
            name: screenDir.replace(/untitled_screen_/, "Screen ").replace(/_/g, " "),
            code,
            imageUrl: fs.existsSync(imagePath) ? 
              `https://raw.githubusercontent.com/dalmaer/stitch-mcp/main/projects/${projectDir}/${screenDir}/screen.png` : 
              undefined,
            updatedAt: fs.existsSync(codePath) ? fs.statSync(codePath).mtime.toISOString() : undefined,
          };
          screens.push(screen);
        }
      }

      const projectStat = fs.statSync(projectPath);
      const project: ProjectDetail = {
        id: projectDir,
        name: projectDir.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        prompt,
        screens,
        updatedAt: projectStat.mtime.toISOString(),
      };

      projects.push(project);
    } catch (error) {
      console.warn(`Failed to read project ${projectDir}:`, error);
    }
  }

  return projects;
}

// ---------------------------
// Tool Handlers
// ---------------------------

function toSummary(p: ProjectDetail): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    prompt: p.prompt,
    screenCount: p.screens.length,
    updatedAt: p.updatedAt,
  };
}

function listProjectsImpl(): { projects: ProjectSummary[] } {
  const projects = readProjectsFromFilesystem()
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .map(toSummary);
  return { projects };
}

function searchProjectsImpl(query: string): { projects: ProjectSummary[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { projects: [] };
  
  const allProjects = readProjectsFromFilesystem();
  const nameMatches: ProjectDetail[] = [];
  const promptMatches: ProjectDetail[] = [];
  
  for (const p of allProjects) {
    const inName = p.name.toLowerCase().includes(q);
    const inPrompt = p.prompt.toLowerCase().includes(q);
    
    if (inName) {
      nameMatches.push(p);
    } else if (inPrompt) {
      promptMatches.push(p);
    }
  }
  
  const ranked = [...nameMatches, ...promptMatches]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return { projects: ranked.map(toSummary) };
}

function getProjectImpl(projectId: string): { project: ProjectDetail } {
  const projects = readProjectsFromFilesystem();
  const found = projects.find(p => p.id === projectId);
  
  if (!found) {
    const err: any = new Error("Project not found");
    err.code = "not_found";
    err.data = { projectId };
    throw err;
  }
  
  return { project: found };
}

function getScreenImpl(projectId: string, screenId: string): { screen: ScreenAsset } {
  const { project } = getProjectImpl(projectId);
  const screen = project.screens.find(s => s.id === screenId);
  
  if (!screen) {
    const err: any = new Error("Screen not found");
    err.code = "not_found";
    err.data = { projectId, screenId };
    throw err;
  }
  
  return { screen };
}

function getScreenImageImpl(projectId: string, screenId: string): { image: string; mimeType: string } {
  const { project } = getProjectImpl(projectId);
  const screen = project.screens.find(s => s.id === screenId);
  
  if (!screen) {
    const err: any = new Error("Screen not found");
    err.code = "not_found";
    err.data = { projectId, screenId };
    throw err;
  }
  
  if (!screen.imageUrl || !fs.existsSync(screen.imageUrl)) {
    const err: any = new Error("Screen image not found");
    err.code = "not_found";
    err.data = { projectId, screenId, imagePath: screen.imageUrl };
    throw err;
  }
  
  const imageBuffer = fs.readFileSync(screen.imageUrl);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = screen.imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
  
  return { 
    image: base64Image,
    mimeType
  };
}

// -----------------
// MCP Server Setup
// -----------------

const server = new McpServer({
  name: "stitch-mcp-debug",
  version: "0.2.0"
});

// Resources
server.registerResource(
  "project",
  "stitch:project/{projectId}",
  {
    title: "Stitch Project",
    description: "Project detail including prompt and screens",
    mimeType: "application/json"
  },
  async (uri) => {
    const match = uri.href.match(/^stitch:project\/([^\/]+)$/);
    if (!match) throw new Error("Invalid URI pattern");
    const projectId = match[1];
    const { project } = getProjectImpl(projectId);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(project, null, 2)
      }]
    };
  }
);

server.registerResource(
  "screen",
  "stitch:project/{projectId}/screen/{screenId}",
  {
    title: "Stitch Screen",
    description: "Screen asset by projectId and screenId",
    mimeType: "application/json"
  },
  async (uri) => {
    const match = uri.href.match(/^stitch:project\/([^\/]+)\/screen\/([^\/]+)$/);
    if (!match) throw new Error("Invalid URI pattern");
    const [, projectId, screenId] = match;
    const { screen } = getScreenImpl(projectId, screenId);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(screen, null, 2)
      }]
    };
  }
);

// Tools
server.registerTool(
  "list_projects",
  {
    title: "List Projects",
    description: "List projects from the projects/ directory.",
    inputSchema: {}
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(listProjectsImpl(), null, 2) }]
  })
);

server.registerTool(
  "search_projects",
  {
    title: "Search Projects",
    description: "Search projects by query across name and prompt.",
    inputSchema: { query: z.string().min(1) }
  },
  async ({ query }) => ({
    content: [{ type: "text", text: JSON.stringify(searchProjectsImpl(String(query)), null, 2) }]
  })
);

server.registerTool(
  "get_project",
  {
    title: "Get Project",
    description: "Get project detail including prompt and screens.",
    inputSchema: { projectId: z.string().min(1) }
  },
  async ({ projectId }) => ({
    content: [{ type: "text", text: JSON.stringify(getProjectImpl(String(projectId)), null, 2) }]
  })
);

server.registerTool(
  "get_screen",
  {
    title: "Get Screen",
    description: "Get a single screen asset by projectId and screenId.",
    inputSchema: { 
      projectId: z.string().min(1), 
      screenId: z.string().min(1) 
    }
  },
  async ({ projectId, screenId }) => ({
    content: [{ type: "text", text: JSON.stringify(getScreenImpl(String(projectId), String(screenId)), null, 2) }]
  })
);

server.registerTool(
  "generate_screen",
  {
    title: "Generate Screen",
    description: "Generate a screen based on context. Types: parked, pain, anagram, dog. Returns first screen for projects or dog.png for dog type.",
    inputSchema: { 
      type: z.enum(["parked", "pain", "anagram", "dog"]).describe("Screen type to generate based on context")
    }
  },
  async ({ type }) => {
    const typeStr = String(type);
    
    if (typeStr === "dog") {
      // Return dog image
      const dogImagePath = path.join(IMAGES_DIR, "dog.png");
      if (!fs.existsSync(dogImagePath)) {
        const err: any = new Error("Dog image not found");
        err.code = "not_found";
        err.data = { type: typeStr, imagePath: dogImagePath };
        throw err;
      }
      
      const stats = fs.statSync(dogImagePath);
      const fileSizeKB = stats.size / 1024;
      const publicUrl = `https://raw.githubusercontent.com/dalmaer/stitch-mcp/main/images/dog.png`;
      
      if (fileSizeKB > 100) {
        return {
          content: [{ 
            type: "text", 
            text: `Dog image (${Math.round(fileSizeKB)}KB - too large for inline display):\n\n${publicUrl}\n\nClick the link above to view the image.` 
          }]
        };
      }
      
      const imageBuffer = fs.readFileSync(dogImagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = 'image/png';
      
      return {
        content: [
          { type: "text", text: `Dog image (${Math.round(fileSizeKB)}KB):\n\nPublic URL: ${publicUrl}` },
          { type: "image", data: base64Image, mimeType }
        ]
      };
    }
    
    // Map type to project ID
    let projectId: string;
    switch (typeStr) {
      case "parked": projectId = "parked"; break;
      case "pain": projectId = "pain_tracker"; break;
      case "anagram": projectId = "anagram_solver"; break;
      default:
        const err: any = new Error("Unknown screen type");
        err.code = "invalid_type";
        err.data = { type: typeStr };
        throw err;
    }
    
    // Get the first screen from the project
    const { project } = getProjectImpl(projectId);
    if (project.screens.length === 0) {
      const err: any = new Error("No screens found in project");
      err.code = "no_screens";
      err.data = { projectId, type: typeStr };
      throw err;
    }
    
    const firstScreen = project.screens[0];
    const localImagePath = path.join(PROJECTS_DIR, projectId, firstScreen.id, "screen.png");
    
    if (!fs.existsSync(localImagePath)) {
      const err: any = new Error("Screen image not found");
      err.code = "not_found";
      err.data = { projectId, screenId: firstScreen.id, imagePath: localImagePath };
      throw err;
    }
    
    // Same logic as get_screen_image for the project screens
    const stats = fs.statSync(localImagePath);
    const fileSizeKB = stats.size / 1024;
    const publicUrl = `https://raw.githubusercontent.com/dalmaer/stitch-mcp/main/projects/${projectId}/${firstScreen.id}/screen.png`;
    
    if (fileSizeKB > 100) {
      return {
        content: [{ 
          type: "text", 
          text: `Generated screen for ${typeStr} (${project.name} - ${firstScreen.name}) (${Math.round(fileSizeKB)}KB - too large for inline display):\n\n${publicUrl}\n\nClick the link above to view the screenshot.` 
        }]
      };
    }
    
    const imageBuffer = fs.readFileSync(localImagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/png';
    
    return {
      content: [
        { type: "text", text: `Generated screen for ${typeStr} (${project.name} - ${firstScreen.name}) (${Math.round(fileSizeKB)}KB):\n\nPublic URL: ${publicUrl}` },
        { type: "image", data: base64Image, mimeType }
      ]
    };
  }
);

server.registerTool(
  "get_screen_image",
  {
    title: "Get Screen Image",
    description: "Get the screenshot image for a screen, displayed inline.",
    inputSchema: { 
      projectId: z.string().min(1), 
      screenId: z.string().min(1) 
    }
  },
  async ({ projectId, screenId }) => {
    const { project } = getProjectImpl(String(projectId));
    const screen = project.screens.find(s => s.id === String(screenId));
    
    if (!screen) {
      const err: any = new Error("Screen not found");
      err.code = "not_found";
      err.data = { projectId, screenId };
      throw err;
    }
    
    // Get the local file path for reading the image
    const localImagePath = path.join(PROJECTS_DIR, projectId, screenId, "screen.png");
    
    if (!fs.existsSync(localImagePath)) {
      const err: any = new Error("Screen image not found");
      err.code = "not_found";
      err.data = { projectId, screenId, imagePath: localImagePath };
      throw err;
    }
    
    // Check file size before encoding (limit to ~100KB for inline display)
    const stats = fs.statSync(localImagePath);
    const fileSizeKB = stats.size / 1024;
    const publicUrl = `https://raw.githubusercontent.com/dalmaer/stitch-mcp/main/projects/${projectId}/${screenId}/screen.png`;
    
    if (fileSizeKB > 100) {
      // File too large, return URL instead
      return {
        content: [{ 
          type: "text", 
          text: `Screen image for ${projectId}/${screenId} (${Math.round(fileSizeKB)}KB - too large for inline display):\n\n${publicUrl}\n\nClick the link above to view the full-size screenshot.` 
        }]
      };
    }
    
    // Read and encode the image for inline display
    const imageBuffer = fs.readFileSync(localImagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/png';
    
    return {
      content: [
        { type: "text", text: `Screen image for ${projectId}/${screenId} (${Math.round(fileSizeKB)}KB):\n\nPublic URL: ${publicUrl}` },
        { type: "image", data: base64Image, mimeType }
      ]
    };
  }
);

// CLI and main function
const [, , cmd, ...args] = process.argv;

// Parse CLI arguments
function parseArgs(args: string[]) {
  const parsed = { projectsDir: "", command: "", commandArgs: [] as string[] };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--projects-dir" && i + 1 < args.length) {
      parsed.projectsDir = args[i + 1];
      i++; // skip the next argument since it's the value
    } else if (!parsed.command) {
      parsed.command = args[i];
    } else {
      parsed.commandArgs.push(args[i]);
    }
  }
  
  return parsed;
}

async function main() {
  const allArgs = [cmd, ...args].filter(Boolean);
  const parsed = parseArgs(allArgs);
  
  // Set projects directory if provided
  if (parsed.projectsDir) {
    setProjectsDirectory(parsed.projectsDir);
  }
  
  // Check if we should run as MCP server or CLI
  if (!parsed.command) {
    // Check for BASE_DIR environment variable first, then PROJECTS_DIR as fallback
    const envBaseDir = process.env.BASE_DIR;
    const envProjectsDir = process.env.PROJECTS_DIR;
    
    if (envBaseDir) {
      setBaseDirectory(envBaseDir);
    } else if (envProjectsDir) {
      setProjectsDirectory(envProjectsDir);
    }
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }
  
  const out = (obj: any) => console.log(JSON.stringify(obj, null, 2));
  switch (parsed.command) {
    case "list_projects": out(listProjectsImpl()); break;
    case "search_projects": out(searchProjectsImpl(parsed.commandArgs.join(" "))); break;
    case "get_project": {
      const id = parsed.commandArgs[0]; 
      if (!id) throw new Error("Usage: get_project [--projects-dir <path>] <projectId>");
      out(getProjectImpl(id)); 
      break;
    }
    case "get_screen": {
      const [pid, sid] = parsed.commandArgs; 
      if (!pid || !sid) throw new Error("Usage: get_screen [--projects-dir <path>] <projectId> <screenId>");
      out(getScreenImpl(pid, sid)); 
      break;
    }
    case "get_screen_image": {
      const [pid, sid] = parsed.commandArgs; 
      if (!pid || !sid) throw new Error("Usage: get_screen_image [--projects-dir <path>] <projectId> <screenId>");
      out(getScreenImageImpl(pid, sid)); 
      break;
    }
    case "generate_screen": {
      const [type] = parsed.commandArgs; 
      if (!type) throw new Error("Usage: generate_screen [--projects-dir <path>] <type>");
      // This would require implementing the full tool logic for CLI
      console.error("generate_screen CLI support not fully implemented - use MCP server mode");
      process.exit(1);
    }
    case "read_resource": {
      const [uri] = parsed.commandArgs; 
      if (!uri) throw new Error("Usage: read_resource [--projects-dir <path>] <uri>");
      out(readResourceUri(uri)); 
      break;
    }
    default:
      console.error("Unknown command. Available commands: list_projects, search_projects, get_project, get_screen, get_screen_image, generate_screen, read_resource");
      console.error("Options: --projects-dir <path>");
      process.exit(1);
  }
}

// Simple local resource reader (CLI helper)
function readResourceUri(uri: string) {
  let m = uri.match(/^stitch:project\/([^\/]+)$/);
  if (m) {
    const { project } = getProjectImpl(m[1]);
    return { contents: [{ uri, mimeType: "application/json", data: project }] };
  }
  
  m = uri.match(/^stitch:project\/([^\/]+)\/screen\/([^\/]+)$/);
  if (m) {
    const { screen } = getScreenImpl(m[1], m[2]);
    return { contents: [{ uri, mimeType: "application/json", data: screen }] };
  }
  
  throw new Error("Unsupported URI pattern");
}

main().catch((e) => { console.error(e); process.exit(1); });