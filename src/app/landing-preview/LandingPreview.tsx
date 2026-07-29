import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Barcode,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  Glasses,
  Layers3,
  MapPin,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import styles from "./LandingPreview.module.css";

const CATALOG_FRAMES = [
  { brand: "Studio Collection", model: "LW-101", color: "#49a7e8", accent: "#f1b25f" },
  { brand: "Heritage Collection", model: "LW-204", color: "#9d6dd7", accent: "#bfe16a" },
  { brand: "Everyday Collection", model: "LW-318", color: "#e3788d", accent: "#69d6c4" },
];

const INVENTORY_ROWS = [
  { name: "LW-101 · Ocean Tortoise", detail: "52–18–135", stock: 4, tone: "good" },
  { name: "LW-204 · Graphite", detail: "50–17–140", stock: 2, tone: "low" },
  { name: "LW-318 · Crystal Rose", detail: "53–16–138", stock: 7, tone: "good" },
];

function FrameGlyph({ color, accent }: { color: string; accent: string }) {
  return (
    <span className={styles.frameGlyph} style={{ "--frame": color, "--accent": accent } as React.CSSProperties}>
      <span />
      <span />
      <i />
    </span>
  );
}

export function LandingPreview({ isAuthenticated }: { isAuthenticated: boolean }) {
  const primaryHref = isAuthenticated ? "/app" : "/start-trial";
  const primaryLabel = isAuthenticated ? "Open LensWise" : "Start free trial";

  return (
    <div className={styles.previewRoot}>
      <div className={styles.ambientGlow} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="LensWise home">
          <span className={styles.wordmarkIcon}><Glasses aria-hidden="true" /></span>
          LensWise
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#locations">Locations</a>
          <a href="#workflow">Workflow</a>
        </nav>

        <div className={styles.headerActions}>
          {!isAuthenticated ? <Link href="/login" className={styles.compareLink}>Sign in</Link> : null}
          <Link href={primaryHref} className={styles.smallCta}>
            {isAuthenticated ? "Open app" : "Try LensWise"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroOrbOne} aria-hidden="true" />
          <div className={styles.heroOrbTwo} aria-hidden="true" />

          <div className={styles.heroCopy}>
            <div className={styles.previewPill}>
              <Sparkles aria-hidden="true" />
              New LensWise experience
            </div>
            <h1>
              Your optical office,
              <span>finally in focus.</span>
            </h1>
            <p>
              Quote, stock, sell, and sync every location from one calm workspace
              built around the way optical teams actually work.
            </p>
            <div className={styles.heroActions}>
              <Link href={primaryHref} className={styles.primaryCta}>
                {primaryLabel}
                <ArrowRight aria-hidden="true" />
              </Link>
              <a href="#platform" className={styles.secondaryCta}>
                See how it flows
                <ArrowDown aria-hidden="true" />
              </a>
            </div>
            <div className={styles.heroProof}>
              <span><CheckCircle2 aria-hidden="true" /> Guided optical quotes</span>
              <span><CheckCircle2 aria-hidden="true" /> Live frame inventory</span>
              <span><CheckCircle2 aria-hidden="true" /> Location-ready</span>
            </div>
          </div>

          <div className={styles.heroStage} aria-hidden="true">
            <div className={styles.orbitLarge} />
            <div className={styles.orbitSmall} />
            <div className={styles.heroLensLeft}>
              <span>01</span>
              <strong>Build the quote</strong>
              <small>Prescription to price</small>
            </div>
            <div className={styles.heroLensRight}>
              <span>02</span>
              <strong>Complete the sale</strong>
              <small>Payment noted. Stock updated.</small>
            </div>
            <div className={styles.heroBridge} />
            <div className={styles.floatingCardOne}>
              <PackageCheck aria-hidden="true" />
              <span><strong>Inventory synced</strong><small>Location A</small></span>
            </div>
            <div className={styles.floatingCardTwo}>
              <Database aria-hidden="true" />
              <span><strong>Frame catalog</strong><small>Color + size variants</small></span>
            </div>
            <div className={styles.floatingDot} />
          </div>

          <a href="#platform" className={styles.scrollCue}>
            <span>Scroll to explore</span>
            <ArrowDown aria-hidden="true" />
          </a>
        </section>

        <section id="platform" className={styles.intro}>
          <p className={styles.kicker}>One optical operating system</p>
          <h2>
            Less tab switching.
            <span>More patient time.</span>
          </h2>
          <p className={styles.introText}>
            LensWise connects the parts of a frame sale that are usually scattered
            across catalogs, notes, spreadsheets, and memory.
          </p>
          <div className={styles.flowRail} aria-label="LensWise workflow">
            {[
              ["01", "Browse"],
              ["02", "Stock"],
              ["03", "Quote"],
              ["04", "Sell"],
              ["05", "Sync"],
            ].map(([number, label], index) => (
              <div key={number} className={styles.flowStep}>
                <span>{number}</span>
                <strong>{label}</strong>
                {index < 4 ? <ChevronRight aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.storySection}>
          <div className={styles.storyCopy}>
            <span className={styles.storyNumber}>01 / Frame database</span>
            <h2>A catalog that feels more like shopping.</h2>
            <p>
              Search your curated frame database by collection, compare models, and
              choose the exact color and size combination before it reaches inventory.
            </p>
            <ul>
              <li><Check aria-hidden="true" /> Grouped models with visual color dots</li>
              <li><Check aria-hidden="true" /> Size and color availability built in</li>
              <li><Check aria-hidden="true" /> Add multiple variants in one pass</li>
            </ul>
          </div>

          <div className={styles.stickyScene} aria-hidden="true">
            <div className={`${styles.appWindow} ${styles.catalogWindow}`}>
              <div className={styles.windowBar}>
                <div className={styles.windowDots}><i /><i /><i /></div>
                <span>Frame catalog</span>
                <div className={styles.windowUser}>LW</div>
              </div>
              <div className={styles.catalogToolbar}>
                <div className={styles.searchBox}><Search aria-hidden="true" /> Search models, brands, colors…</div>
                <div className={styles.filterChip}>All collections <ChevronRight aria-hidden="true" /></div>
              </div>
              <div className={styles.catalogGrid}>
                {CATALOG_FRAMES.map((frame, index) => (
                  <div key={frame.model} className={`${styles.frameCard} ${index === 1 ? styles.activeFrameCard : ""}`}>
                    <div className={styles.frameVisual}>
                      <FrameGlyph color={frame.color} accent={frame.accent} />
                      {index === 1 ? <span className={styles.selectedCheck}><Check aria-hidden="true" /></span> : null}
                    </div>
                    <small>{frame.brand}</small>
                    <strong>{frame.model}</strong>
                    <span>52–18–140</span>
                    <div className={styles.variantRow}>
                      <i style={{ background: frame.color }} />
                      <i style={{ background: frame.accent }} />
                      <i style={{ background: "#283449" }} />
                      <em>{index + 2} colors</em>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.catalogFooter}>
                <span>Page 1 of 18</span>
                <button type="button" tabIndex={-1}>Add selected frames <ArrowRight aria-hidden="true" /></button>
              </div>
            </div>
            <div className={styles.sceneLabel}><Database aria-hidden="true" /> Your frame database</div>
          </div>
        </section>

        <section id="locations" className={`${styles.storySection} ${styles.storyReverse}`}>
          <div className={styles.storyCopy}>
            <span className={styles.storyNumber}>02 / Inventory + locations</span>
            <h2>Every frame. Every office. Exactly where it belongs.</h2>
            <p>
              Keep each location&apos;s stock separate while managing the entire
              business under one account. Low-stock signals stay local and visible.
            </p>
            <ul>
              <li><Check aria-hidden="true" /> Inventory by color, size, and location</li>
              <li><Check aria-hidden="true" /> Office pricing and stock thresholds</li>
              <li><Check aria-hidden="true" /> One account across multiple offices</li>
            </ul>
          </div>

          <div className={styles.stickyScene} aria-hidden="true">
            <div className={`${styles.appWindow} ${styles.inventoryWindow}`}>
              <div className={styles.windowBar}>
                <div className={styles.windowDots}><i /><i /><i /></div>
                <span>Inventory overview</span>
                <div className={styles.windowUser}>NS</div>
              </div>
              <div className={styles.inventoryHeader}>
                <div><small>Current location</small><strong><MapPin aria-hidden="true" /> Location A</strong></div>
                <button type="button" tabIndex={-1}>Switch location <ChevronRight aria-hidden="true" /></button>
              </div>
              <div className={styles.inventoryStats}>
                <div><span>Frames in stock</span><strong>146</strong><small>+12 this month</small></div>
                <div><span>Low stock</span><strong>03</strong><small>Needs attention</small></div>
                <div><span>Locations</span><strong>02</strong><small>One organization</small></div>
              </div>
              <div className={styles.inventoryTable}>
                <div className={styles.tableHeading}><span>Frame</span><span>On hand</span><span>Status</span></div>
                {INVENTORY_ROWS.map((row, index) => (
                  <div key={row.name} className={styles.inventoryRow}>
                    <span className={styles.inventoryFrameGlyph}>
                      <FrameGlyph
                        color={CATALOG_FRAMES[index].color}
                        accent={CATALOG_FRAMES[index].accent}
                      />
                    </span>
                    <span className={styles.inventoryFrameDetails}>
                      <strong>{row.name}</strong>
                      <small>{row.detail}</small>
                    </span>
                    <b>{row.stock}</b>
                    <em className={row.tone === "low" ? styles.lowStock : styles.inStock}>
                      {row.tone === "low" ? "Low stock" : "In stock"}
                    </em>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.locationStack} aria-hidden="true">
              <div><span><Store /></span><strong>Location A</strong><small>146 frames · Primary</small></div>
              <div><span><Building2 /></span><strong>Location B</strong><small>132 frames · Synced</small></div>
            </div>
          </div>
        </section>

        <section id="workflow" className={styles.saleSection}>
          <div className={styles.saleBackdrop} aria-hidden="true" />
          <div className={styles.saleCopy}>
            <span className={styles.storyNumber}>03 / Quote to sold</span>
            <h2>The sale closes the loop.</h2>
            <p>
              Build the prescription and lens package, share a patient-friendly
              quote, then record the payment after it&apos;s collected. Linked frame
              stock updates only when the sale is completed.
            </p>
          </div>

          <div className={styles.saleJourney}>
            <div className={`${styles.journeyCard} ${styles.quoteCard}`}>
              <div className={styles.journeyIcon}><Layers3 aria-hidden="true" /></div>
              <span>Guided quote</span>
              <strong>Progressive · 1.67</strong>
              <small>Prescription, PD, frame, lenses, add-ons</small>
              <div className={styles.progressTrack}><i /></div>
              <em>Ready to review</em>
            </div>

            <div className={styles.journeyArrow}><ArrowRight aria-hidden="true" /></div>

            <div className={`${styles.journeyCard} ${styles.paymentCard}`}>
              <div className={styles.journeyIcon}><CircleDollarSign aria-hidden="true" /></div>
              <span>Payment recorded</span>
              <strong>Card payment · $428.00</strong>
              <small>Collected outside LensWise</small>
              <div className={styles.paymentConfirmed}><CheckCircle2 aria-hidden="true" /> Sale completed</div>
            </div>

            <div className={styles.journeyArrow}><ArrowRight aria-hidden="true" /></div>

            <div className={`${styles.journeyCard} ${styles.stockCard}`}>
              <div className={styles.journeyIcon}><Barcode aria-hidden="true" /></div>
              <span>Inventory updated</span>
              <strong>LW-204 · Graphite</strong>
              <small>Location A</small>
              <div className={styles.stockMovement}><i>3</i><ArrowRight aria-hidden="true" /><i>2</i></div>
            </div>
          </div>
        </section>

        <section className={styles.featureCloud}>
          <div className={styles.featureCloudIntro}>
            <p className={styles.kicker}>Built for the whole counter</p>
            <h2>Small details that keep the day moving.</h2>
          </div>
          <div className={styles.featurePills}>
            <span><Glasses aria-hidden="true" /> Guided lens selection</span>
            <span><ShieldCheck aria-hidden="true" /> Insurance calculations</span>
            <span><PackageCheck aria-hidden="true" /> Low-stock alerts</span>
            <span><Database aria-hidden="true" /> Frame images and measurements</span>
            <span><Building2 aria-hidden="true" /> Location-specific inventory</span>
            <span><CircleDollarSign aria-hidden="true" /> Sale and payment history</span>
          </div>
        </section>

        <section className={styles.finalCta}>
          <div className={styles.ctaOrbit} aria-hidden="true" />
          <p className={styles.kicker}>Bring the office into focus</p>
          <h2>One workspace.<br />A clearer way to sell eyewear.</h2>
          <p>From the first frame selection to the final stock count.</p>
          <Link href={primaryHref} className={styles.primaryCta}>
            {primaryLabel}
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link href="/" className={styles.wordmark}>
          <span className={styles.wordmarkIcon}><Glasses aria-hidden="true" /></span>
          LensWise
        </Link>
        <p>Modern optical operations, brought into focus.</p>
        <nav aria-label="Footer navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href={isAuthenticated ? "/app" : "/login"}>
            {isAuthenticated ? "Open app" : "Sign in"}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
