export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">
              ⚡
            </div>
            <h1 className="text-xl font-bold">FastMCP</h1>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
              TypeScript
            </span>
          </div>
          <nav className="flex gap-6 text-sm text-gray-400">
            <a href="#architecture" className="hover:text-white transition">
              Architecture
            </a>
            <a href="#api" className="hover:text-white transition">
              API
            </a>
            <a href="#status" className="hover:text-white transition">
              Status
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Model Context Protocol
        </h2>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          A comprehensive TypeScript/Next.js framework for building MCP servers
          and clients. Port of the Python FastMCP framework.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/api/mcp"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
          >
            Server Info →
          </a>
          <a
            href="/api/mcp/tools"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
          >
            Browse Tools
          </a>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="container mx-auto px-6 py-16">
        <h3 className="text-3xl font-bold mb-12 text-center">Architecture</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <ArchCard
            title="🔧 Tools"
            description="Register functions as MCP tools with Zod schema validation, auth checks, timeouts, and structured results."
            code={`mcp.addTool({
  name: "add",
  schema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  handler: ({ a, b }) => a + b,
});`}
          />
          <ArchCard
            title="📦 Resources"
            description="Serve data as MCP resources with URI-based addressing, templates for parameterized resources, and MIME types."
            code={`mcp.addResource({
  name: "config",
  uri: "data://config",
  handler: () => ({
    debug: false,
    version: "1.0",
  }),
});`}
          />
          <ArchCard
            title="💬 Prompts"
            description="Define reusable prompt templates with typed arguments, multi-turn conversations, and role-based messages."
            code={`mcp.addPrompt({
  name: "review",
  arguments: [
    { name: "code", required: true },
  ],
  handler: ({ code }) =>
    \`Review: \${code}\`,
});`}
          />
        </div>
      </section>

      {/* API Endpoints */}
      <section id="api" className="container mx-auto px-6 py-16">
        <h3 className="text-3xl font-bold mb-12 text-center">API Endpoints</h3>
        <div className="max-w-3xl mx-auto space-y-4">
          <ApiRow method="GET" path="/api/mcp" description="Server information" />
          <ApiRow method="GET" path="/api/mcp/tools" description="List all tools" />
          <ApiRow
            method="GET"
            path="/api/mcp/resources"
            description="List all resources"
          />
          <ApiRow method="GET" path="/api/mcp/prompts" description="List all prompts" />
          <ApiRow
            method="POST"
            path="/api/mcp"
            description="JSON-RPC 2.0 endpoint for tool calls, resource reads, prompt rendering"
          />
        </div>
      </section>

      {/* Port Status */}
      <section id="status" className="container mx-auto px-6 py-16">
        <h3 className="text-3xl font-bold mb-12 text-center">Port Status</h3>
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatusItem label="Core Types & Interfaces" status="done" />
          <StatusItem label="Tool System (FunctionTool)" status="done" />
          <StatusItem label="Resource System" status="done" />
          <StatusItem label="Prompt System" status="done" />
          <StatusItem label="Provider System" status="done" />
          <StatusItem label="Middleware Pipeline" status="done" />
          <StatusItem label="Auth System" status="done" />
          <StatusItem label="Context & State" status="done" />
          <StatusItem label="Client SDK Core" status="done" />
          <StatusItem label="Next.js API Handler" status="done" />
          <StatusItem label="Server Transports (SSE/stdio)" status="pending" />
          <StatusItem label="Transform System" status="pending" />
          <StatusItem label="OpenAPI Provider" status="pending" />
          <StatusItem label="Task System" status="pending" />
          <StatusItem label="CLI Commands" status="pending" />
          <StatusItem label="Full Client Transport" status="pending" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 py-8 text-center text-gray-500 text-sm">
        <p>FastMCP TypeScript Port — Built with Next.js, TypeScript, and Zod</p>
      </footer>
    </div>
  );
}

function ArchCard({
  title,
  description,
  code,
}: {
  title: string;
  description: string;
  code: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition">
      <h4 className="text-lg font-bold mb-3">{title}</h4>
      <p className="text-gray-400 text-sm mb-4">{description}</p>
      <pre className="bg-gray-900 rounded-lg p-3 text-xs text-green-400 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ApiRow({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) {
  const colors: Record<string, string> = {
    GET: "bg-green-500/20 text-green-400",
    POST: "bg-blue-500/20 text-blue-400",
  };

  return (
    <div className="flex items-center gap-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
      <span
        className={`px-2 py-1 rounded text-xs font-mono font-bold ${colors[method] ?? "bg-gray-600"}`}
      >
        {method}
      </span>
      <code className="text-sm text-gray-300 font-mono">{path}</code>
      <span className="text-sm text-gray-500 ml-auto">{description}</span>
    </div>
  );
}

function StatusItem({
  label,
  status,
}: {
  label: string;
  status: "done" | "pending" | "wip";
}) {
  const icons = { done: "✅", pending: "⬜", wip: "🔧" };
  const colors = {
    done: "text-green-400",
    pending: "text-gray-500",
    wip: "text-yellow-400",
  };

  return (
    <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3 border border-gray-700">
      <span>{icons[status]}</span>
      <span className={`text-sm ${colors[status]}`}>{label}</span>
    </div>
  );
}
