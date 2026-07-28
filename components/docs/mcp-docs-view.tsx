'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingNav } from '@/components/landing/landing-nav'
import {
  VIEWBAIT_MCP_ENDPOINT,
  buildCursorMcpConfigSnippet,
} from '@/lib/mcp/public-endpoint'
import { copyToClipboardWithToast } from '@/lib/utils/clipboard'

type McpClientId = 'cursor' | 'claude' | 'chatgpt'

interface ClientGuide {
  id: McpClientId
  label: string
  blurb: string
  steps: string[]
  tip: string
}

const CLIENT_GUIDES: ClientGuide[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    blurb: 'Best fit if you already live in Cursor. Add ViewBait as a remote MCP server, then authenticate once.',
    steps: [
      'Open Cursor Settings, then go to MCP (or Features → MCP).',
      'Add a new MCP server and choose a remote / URL-based server when prompted.',
      'Paste the ViewBait endpoint exactly (www host, no trailing slash).',
      'Save, then click Connect or Authenticate.',
      'Sign in to ViewBait if asked, then tap Allow on the consent screen.',
      'If the browser stays on ViewBait, click Continue so Cursor can finish the token exchange.',
    ],
    tip: 'You can also drop the JSON snippet below into your Cursor mcp.json.',
  },
  {
    id: 'claude',
    label: 'Claude',
    blurb: 'Use Claude with remote MCP connectors so your assistant can reach your ViewBait projects and thumbnails.',
    steps: [
      'Open Claude settings and find Connectors / MCP (wording varies by Claude surface).',
      'Add a custom connector with the ViewBait MCP URL.',
      'Start the connection flow and approve the ViewBait OAuth consent screen.',
      'Confirm the connector shows as connected, then ask Claude to list your ViewBait projects.',
    ],
    tip: 'If Claude offers dynamic client registration, leave it enabled so setup stays one-click.',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    blurb: 'Connect ViewBait as an MCP app so ChatGPT can generate and compare thumbnails with your account credits.',
    steps: [
      'Open ChatGPT settings and look for Apps / MCP connectors.',
      'Add a new connector using the ViewBait MCP endpoint.',
      'Complete sign-in and Allow on ViewBait consent.',
      'Return to chat and verify ViewBait tools are available for the conversation.',
    ],
    tip: 'Use the exact www URL. Apex redirects can leave ChatGPT stuck on token exchange.',
  },
]

const TOOL_ROWS: { name: string; does: string }[] = [
  { name: 'get_account_context', does: 'Plan, credits, and generation limits' },
  { name: 'list_projects', does: 'Browse owned and shared projects' },
  { name: 'get_project_workspace', does: 'Project defaults and recent thumbnails' },
  { name: 'create_project / update_project', does: 'Create or update project settings' },
  { name: 'list_generation_assets', does: 'Styles, palettes, and saved faces' },
  { name: 'list_thumbnails', does: 'Filter and page through thumbnails' },
  { name: 'generate_thumbnails', does: 'Generate 1–4 thumbnails with normal credits' },
  { name: 'edit_thumbnail', does: 'Create an edited version of a thumbnail' },
  { name: 'compare_thumbnails', does: 'Creative comparison of 2–4 options' },
]

const TROUBLE_ITEMS: { title: string; body: ReactNode }[] = [
  {
    title: 'Stuck on “Exchanging token…”',
    body: (
      <>
        Consent only issues an authorization code. Your client still has to exchange it.
        Use exactly <code className="mcp-docs-inline-code">{VIEWBAIT_MCP_ENDPOINT}</code>,
        click <strong>Continue</strong> if the browser stays on ViewBait, and retry Connect if you waited longer than about 10 minutes.
      </>
    ),
  },
  {
    title: 'I used viewbait.app without www',
    body: (
      <>
        Apex redirects to www and breaks OAuth discovery. Delete the broken server entry and reconnect with the www URL.
      </>
    ),
  },
  {
    title: 'Consent worked, but tools fail',
    body: (
      <>
        Make sure you are signed into the same ViewBait account you use in Studio. Generation still spends your plan credits and respects tier limits.
      </>
    ),
  },
  {
    title: 'Browser blocked the return to Cursor',
    body: (
      <>
        Some browsers block <code className="mcp-docs-inline-code">cursor://</code> callbacks.
        Stay on the ViewBait success screen and use the <strong>Continue</strong> button to hand control back to the client.
      </>
    ),
  },
]

/**
 * Public docs page for connecting a remote MCP client to ViewBait.
 * Prioritizes the canonical endpoint, client-specific steps, and common OAuth failures.
 */
export function McpDocsView() {
  const [scrollY, setScrollY] = useState(0)
  const [activeClient, setActiveClient] = useState<McpClientId>('cursor')
  const [openTrouble, setOpenTrouble] = useState<number | null>(0)

  useEffect(() => {
    let rafId: number | null = null
    let lastY = 0
    let lastSetTime = 0
    const throttleMs = 100

    const handleScroll = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const y =
          typeof window !== 'undefined'
            ? (window.scrollY ?? document.documentElement.scrollTop)
            : 0
        const now = Date.now()
        if (now - lastSetTime >= throttleMs || Math.abs(y - lastY) > 80) {
          lastY = y
          lastSetTime = now
          setScrollY(y)
        }
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])

  const guide = CLIENT_GUIDES.find((item) => item.id === activeClient) ?? CLIENT_GUIDES[0]
  const cursorSnippet = buildCursorMcpConfigSnippet()

  return (
    <div className="landing-page mcp-docs-page" style={{ minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>
      <div className="global-scanlines" aria-hidden />
      <div className="crt-vignette" aria-hidden />
      <div className="interference-line" aria-hidden />
      <div className="noise" aria-hidden />

      <LandingNav scrollY={scrollY} />

      <main className="mcp-docs-main">
        <p className="mcp-docs-eyebrow mono crt-text">DOCS · MCP</p>
        <h1 className="display-text crt-text-heavy mcp-docs-title">Connect ViewBait MCP</h1>
        <p className="mcp-docs-lead crt-text">
          Hook Cursor, Claude, or ChatGPT into your ViewBait account so you can list projects,
          generate thumbnails, edit, and compare without leaving your AI client.
        </p>

        <section className="mcp-docs-endpoint" aria-labelledby="mcp-endpoint-heading">
          <div className="mcp-docs-endpoint-copy">
            <h2 id="mcp-endpoint-heading" className="mcp-docs-section-label mono">
              Your endpoint
            </h2>
            <p className="mcp-docs-endpoint-note crt-text">
              This is the one string that has to be exact. Use www. Skip a trailing slash.
            </p>
          </div>
          <div className="mcp-docs-endpoint-bar">
            <code className="mono mcp-docs-endpoint-url">{VIEWBAIT_MCP_ENDPOINT}</code>
            <button
              type="button"
              className="mcp-docs-copy-btn"
              onClick={() =>
                void copyToClipboardWithToast(VIEWBAIT_MCP_ENDPOINT, 'MCP endpoint copied')
              }
            >
              Copy
            </button>
          </div>
        </section>

        <section className="mcp-docs-section" aria-labelledby="mcp-before-heading">
          <h2 id="mcp-before-heading" className="mcp-docs-h2 crt-text-heavy">
            Before you start
          </h2>
          <ul className="mcp-docs-checklist">
            <li className="crt-text">A ViewBait account you can sign into at viewbait.app</li>
            <li className="crt-text">An MCP client that supports remote servers + OAuth</li>
            <li className="crt-text">About two minutes for the first consent flow</li>
          </ul>
        </section>

        <section className="mcp-docs-section" aria-labelledby="mcp-connect-heading">
          <h2 id="mcp-connect-heading" className="mcp-docs-h2 crt-text-heavy">
            Connect your client
          </h2>
          <p className="mcp-docs-section-intro crt-text">
            Pick your client. Steps stay short on purpose so you can finish while the auth code is still fresh.
          </p>

          <div className="mcp-docs-tabs" role="tablist" aria-label="MCP client">
            {CLIENT_GUIDES.map((client) => {
              const selected = client.id === activeClient
              return (
                <button
                  key={client.id}
                  type="button"
                  role="tab"
                  id={`mcp-tab-${client.id}`}
                  aria-selected={selected}
                  aria-controls={`mcp-panel-${client.id}`}
                  className={`mcp-docs-tab${selected ? ' is-active' : ''}`}
                  onClick={() => setActiveClient(client.id)}
                >
                  {client.label}
                </button>
              )
            })}
          </div>

          <div
            id={`mcp-panel-${guide.id}`}
            role="tabpanel"
            aria-labelledby={`mcp-tab-${guide.id}`}
            className="mcp-docs-panel"
          >
            <p className="mcp-docs-panel-blurb crt-text">{guide.blurb}</p>
            <ol className="mcp-docs-steps">
              {guide.steps.map((step, index) => (
                <li key={step} className="mcp-docs-step">
                  <span className="mcp-docs-step-index mono" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="crt-text">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mcp-docs-tip crt-text">
              <span className="mono mcp-docs-tip-label">Tip</span>
              {guide.tip}
            </p>

            {guide.id === 'cursor' ? (
              <div className="mcp-docs-snippet">
                <div className="mcp-docs-snippet-head">
                  <span className="mono">mcp.json</span>
                  <button
                    type="button"
                    className="mcp-docs-copy-btn mcp-docs-copy-btn-ghost"
                    onClick={() =>
                      void copyToClipboardWithToast(cursorSnippet, 'Cursor config copied')
                    }
                  >
                    Copy JSON
                  </button>
                </div>
                <pre className="mono mcp-docs-pre">
                  <code>{cursorSnippet}</code>
                </pre>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mcp-docs-section" aria-labelledby="mcp-consent-heading">
          <h2 id="mcp-consent-heading" className="mcp-docs-h2 crt-text-heavy">
            What the consent screen means
          </h2>
          <div className="mcp-docs-consent-grid">
            <article className="mcp-docs-consent-card">
              <h3 className="mcp-docs-h3 mono">Allow</h3>
              <p className="crt-text">
                Lets the client use ViewBait on your behalf: projects, assets, generation, edits, and comparisons within your plan.
              </p>
            </article>
            <article className="mcp-docs-consent-card">
              <h3 className="mcp-docs-h3 mono">Deny</h3>
              <p className="crt-text">
                Stops the connection. Nothing changes in Studio. You can reconnect later whenever you want.
              </p>
            </article>
          </div>
        </section>

        <section className="mcp-docs-section" aria-labelledby="mcp-verify-heading">
          <h2 id="mcp-verify-heading" className="mcp-docs-h2 crt-text-heavy">
            How you know it worked
          </h2>
          <ol className="mcp-docs-verify-list">
            <li className="crt-text">Your client shows ViewBait as connected (not pending).</li>
            <li className="crt-text">
              Ask: <em>“What’s my ViewBait plan and remaining credits?”</em> That should hit{' '}
              <code className="mcp-docs-inline-code">get_account_context</code>.
            </li>
            <li className="crt-text">
              Follow up with <em>“List my ViewBait projects”</em> to confirm project access.
            </li>
          </ol>
        </section>

        <section className="mcp-docs-section" aria-labelledby="mcp-tools-heading">
          <h2 id="mcp-tools-heading" className="mcp-docs-h2 crt-text-heavy">
            Tools you unlock
          </h2>
          <div className="mcp-docs-table-wrap hide-scrollbar">
            <table className="mcp-docs-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">What it does</th>
                </tr>
              </thead>
              <tbody>
                {TOOL_ROWS.map((row) => (
                  <tr key={row.name}>
                    <td>
                      <code className="mcp-docs-inline-code">{row.name}</code>
                    </td>
                    <td className="crt-text">{row.does}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mcp-docs-section" aria-labelledby="mcp-trouble-heading">
          <h2 id="mcp-trouble-heading" className="mcp-docs-h2 crt-text-heavy">
            Stuck? Fix it fast
          </h2>
          <div className="mcp-docs-accordion">
            {TROUBLE_ITEMS.map((item, index) => {
              const open = openTrouble === index
              return (
                <div key={item.title} className={`mcp-docs-accordion-item${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="mcp-docs-accordion-trigger"
                    aria-expanded={open}
                    onClick={() => setOpenTrouble(open ? null : index)}
                  >
                    <span className="crt-text-heavy">{item.title}</span>
                    <span className="mono mcp-docs-accordion-icon" aria-hidden>
                      {open ? '−' : '+'}
                    </span>
                  </button>
                  {open ? <div className="mcp-docs-accordion-body crt-text">{item.body}</div> : null}
                </div>
              )
            })}
          </div>
        </section>

        <section className="mcp-docs-cta" aria-label="Next steps">
          <p className="mcp-docs-cta-text crt-text">
            Ready to generate from chat? Open Studio if you still need styles, faces, or credits set up first.
          </p>
          <div className="mcp-docs-cta-actions">
            <a href="/studio" className="btn-crt mcp-docs-cta-primary">
              Open Studio
            </a>
            <a href="/auth" className="mcp-docs-cta-secondary crt-text">
              Sign in
            </a>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
