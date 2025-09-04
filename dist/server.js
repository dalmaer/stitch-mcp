/**
 * Stitch MCP Server (Debug / In‑Memory + Resources Edition)
 * ---------------------------------------------------------
 * Minimal MCP server exposing tools + resource URIs backed by local sample data.
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
 *   ts-node src/server.ts list_projects
 *   ts-node src/server.ts search_projects "checkout"
 *   ts-node src/server.ts get_project p_travel
 *   ts-node src/server.ts get_screen p_parking s1
 *   ts-node src/server.ts read_resource "stitch:project/p_dogfed"
 *   ts-node src/server.ts read_resource "stitch:project/p_travel/screen/s1"
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
// 1×1 PNG (transparent) placeholder
const ONE_BY_ONE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
const code = (language, value) => ({ language, value });
const sampleProjects = [
    {
        id: "p_travel",
        name: "Travel App",
        prompt: "Clean iOS travel UI with flight search",
        updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        chat: [
            { id: "m1", role: "user", content: "Design a flight search screen" },
            { id: "m2", role: "assistant", content: "Here are three variants." },
        ],
        screens: [
            {
                id: "s1",
                name: "Flight Search",
                imageUrl: ONE_BY_ONE_PNG,
                tags: ["search", "hero"],
                code: [
                    code("tsx", `export const FlightSearch = () => (
  <div className="container">
    <h1>Find Flights</h1>
    <form>
      <input placeholder="From" />
      <input placeholder="To" />
      <button>Search</button>
    </form>
  </div>
);`),
                    code("css", `.container{font-family:system-ui;max-width:480px;margin:0 auto;padding:16px}`),
                ],
            },
            {
                id: "s2",
                name: "Results",
                imageUrl: ONE_BY_ONE_PNG,
                tags: ["results", "list"],
                code: [code("tsx", `export const Results = () => <ul><li>Flight A</li></ul>;`)],
            },
        ],
    },
    {
        id: "p_checkout",
        name: "Shop Checkout",
        prompt: "Checkout variants with address + card",
        updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        chat: [
            { id: "m1", role: "user", content: "We need a single-page checkout" },
            { id: "m2", role: "assistant", content: "Variant A uses a drawer for card details; Variant B uses inline sections." },
        ],
        screens: [
            { id: "s1", name: "Checkout A", imageUrl: ONE_BY_ONE_PNG, tags: ["checkout", "drawer"], code: [code("html", `<main><h1>Checkout</h1><section>Address</section><section>Card</section></main>`)] },
            { id: "s2", name: "Checkout B", imageUrl: ONE_BY_ONE_PNG, tags: ["checkout", "inline"] },
            { id: "s3", name: "Confirmation", imageUrl: ONE_BY_ONE_PNG, tags: ["receipt"] },
        ],
    },
    {
        id: "p_onboarding",
        name: "Onboarding Flow",
        prompt: "3-step onboarding for mobile app",
        updatedAt: new Date().toISOString(),
        chat: [
            { id: "m1", role: "system", content: "Use brand blue and rounded buttons" },
            { id: "m2", role: "user", content: "Make step 2 ask for notifications" },
        ],
        screens: [
            { id: "s1", name: "Welcome", imageUrl: ONE_BY_ONE_PNG, tags: ["step1"] },
            { id: "s2", name: "Permissions", imageUrl: ONE_BY_ONE_PNG, tags: ["step2", "notifications"] },
            { id: "s3", name: "Done", imageUrl: ONE_BY_ONE_PNG, tags: ["step3"] },
        ],
    },
    // New samples
    {
        id: "p_parking",
        name: "Parking App",
        prompt: "Track where my car is parked with quick P-level presets and custom spots",
        updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        chat: [
            { id: "m1", role: "user", content: "I park at work on P1-P3; need fast capture" },
            { id: "m2", role: "assistant", content: "Added large tap targets for P0–P3 and note field" },
        ],
        screens: [
            {
                id: "s1",
                name: "Home",
                imageUrl: ONE_BY_ONE_PNG,
                tags: ["home", "quick-actions"],
                code: [
                    code("tsx", `export const Home = () => (
  <div>
    <h1>Where is my car?</h1>
    <div className="grid">
      {["P0","P1","P2","P3"].map(l => <button key={l}>{l}</button>)}
    </div>
    <input placeholder="Custom spot" />
    <button>Save</button>
  </div>
);`),
                ],
            },
            { id: "s2", name: "Saved", imageUrl: ONE_BY_ONE_PNG, tags: ["list", "history"] },
        ],
    },
    {
        id: "p_dogfed",
        name: "Dog Fed?",
        prompt: "Track if the dog has been fed (AM/PM toggles, family contributions)",
        updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        chat: [
            { id: "m1", role: "user", content: "We keep double-feeding by accident. Need AM/PM toggles." },
            { id: "m2", role: "assistant", content: "Added today card with AM/PM and contributors" },
        ],
        screens: [
            {
                id: "s1",
                name: "Today",
                imageUrl: ONE_BY_ONE_PNG,
                tags: ["today", "toggles"],
                code: [
                    code("tsx", `export const Today = () => (
  <section>
    <h1>Dog Fed?</h1>
    <label><input type="checkbox"/> AM</label>
    <label><input type="checkbox"/> PM</label>
    <small>Contributors: Dion, Emily</small>
  </section>
);`),
                ],
            },
            { id: "s2", name: "History", imageUrl: ONE_BY_ONE_PNG, tags: ["history"] },
        ],
    },
];
// --------------
// Tool Handlers
// --------------
function toSummary(p) {
    return {
        id: p.id,
        name: p.name,
        prompt: p.prompt,
        screenCount: p.screens.length,
        updatedAt: p.updatedAt,
    };
}
function listProjectsImpl() {
    const projects = sampleProjects.slice().sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).map(toSummary);
    return { projects };
}
function searchProjectsImpl(query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return { projects: [] };
    const nameMatches = [];
    const chatMatches = [];
    for (const p of sampleProjects) {
        const inName = p.name.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q);
        const inChat = p.chat?.some(m => m.content.toLowerCase().includes(q));
        if (inName)
            nameMatches.push(p);
        else if (inChat)
            chatMatches.push(p);
    }
    const ranked = [...nameMatches, ...chatMatches].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    return { projects: ranked.map(toSummary) };
}
function getProjectImpl(projectId) {
    const found = sampleProjects.find(p => p.id === projectId);
    if (!found) {
        const err = new Error("Project not found");
        err.code = "not_found";
        err.data = { projectId };
        throw err;
    }
    return { project: found };
}
function getScreenImpl(projectId, screenId) {
    const proj = sampleProjects.find(p => p.id === projectId);
    if (!proj) {
        const err = new Error("Project not found");
        err.code = "not_found";
        err.data = { projectId };
        throw err;
    }
    const scr = proj.screens.find(s => s.id === screenId);
    if (!scr) {
        const err = new Error("Screen not found");
        err.code = "not_found";
        err.data = { projectId, screenId };
        throw err;
    }
    return { screen: scr };
}
// -----------------
// MCP Server Setup
// -----------------
const server = new Server({ name: "stitch-mcp-debug", version: "0.2.0" }, { capabilities: { tools: {}, resources: {} } });
// Resources (if SDK supports registration this way)
// @ts-ignore
server.resource?.({ uriPattern: "stitch:project/{projectId}", name: "Stitch Project", mimeType: "application/json" }, async ({ uri, params }) => {
    const { projectId } = params ?? {};
    const { project } = getProjectImpl(String(projectId));
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(project, null, 2) }] };
});
// @ts-ignore
server.resource?.({ uriPattern: "stitch:project/{projectId}/screen/{screenId}", name: "Stitch Screen", mimeType: "application/json" }, async ({ uri, params }) => {
    const { projectId, screenId } = params ?? {};
    const { screen } = getScreenImpl(String(projectId), String(screenId));
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(screen, null, 2) }] };
});
// Tools
server.tool("list_projects", "List projects for the current (mock) user.", { type: "object", properties: {}, additionalProperties: false }, async () => ({ content: [{ type: "json", data: listProjectsImpl() }] }));
server.tool("search_projects", "Search projects by query across name, prompt, and chat.", { type: "object", properties: { query: { type: "string", minLength: 1 } }, required: ["query"], additionalProperties: false }, async ({ query }) => ({ content: [{ type: "json", data: searchProjectsImpl(String(query)) }] }));
server.tool("get_project", "Get project detail including chat and screens.", { type: "object", properties: { projectId: { type: "string", minLength: 1 } }, required: ["projectId"], additionalProperties: false }, async ({ projectId }) => ({ content: [{ type: "json", data: getProjectImpl(String(projectId)) }] }));
server.tool("get_screen", "Get a single screen asset by projectId and screenId.", { type: "object", properties: { projectId: { type: "string", minLength: 1 }, screenId: { type: "string", minLength: 1 } }, required: ["projectId", "screenId"], additionalProperties: false }, async ({ projectId, screenId }) => ({ content: [{ type: "json", data: getScreenImpl(String(projectId), String(screenId)) }] }));
// If running without CLI args, start as an MCP server (stdio). Otherwise run local CLI emulation.
const [, , cmd, ...args] = process.argv;
async function main() {
    if (!cmd) {
        server.start();
        return;
    }
    const out = (obj) => console.log(JSON.stringify(obj, null, 2));
    switch (cmd) {
        case "list_projects":
            out(listProjectsImpl());
            break;
        case "search_projects":
            out(searchProjectsImpl(args.join(" ")));
            break;
        case "get_project": {
            const id = args[0];
            if (!id)
                throw new Error("Usage: get_project <projectId>");
            out(getProjectImpl(id));
            break;
        }
        case "get_screen": {
            const [pid, sid] = args;
            if (!pid || !sid)
                throw new Error("Usage: get_screen <projectId> <screenId>");
            out(getScreenImpl(pid, sid));
            break;
        }
        case "read_resource": {
            const [uri] = args;
            if (!uri)
                throw new Error("Usage: read_resource <uri>");
            out(readResourceUri(uri));
            break;
        }
        default:
            console.error("Unknown command");
            process.exit(1);
    }
}
// Simple local resource reader (CLI helper)
function readResourceUri(uri) {
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
