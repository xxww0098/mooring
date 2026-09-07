import type { IBufferLine, Terminal } from "@xterm/xterm";

export type ScreenRow = { text: string; dim: boolean; wrapped: boolean };

const GRAY_PALETTE_MIN = 236;
const GRAY_PALETTE_MAX = 250;

/** TUIs paint status bars and reasoning traces dim or grey; the answer is full weight. */
function readRow(line: IBufferLine | undefined): ScreenRow {
  if (!line) return { text: "", dim: false, wrapped: false };
  const text = line.translateToString(true);
  let inked = 0;
  let faded = 0;
  for (let x = 0; x < line.length; x += 1) {
    const cell = line.getCell(x);
    if (!cell) continue;
    const chars = cell.getChars();
    if (!chars || chars === " ") continue;
    inked += 1;
    const palette = cell.isFgPalette() ? cell.getFgColor() : -1;
    if (cell.isDim() || palette === 8 || (palette >= GRAY_PALETTE_MIN && palette <= GRAY_PALETTE_MAX)) {
      faded += 1;
    }
  }
  return { text, dim: inked > 0 && faded / inked > 0.7, wrapped: line.isWrapped };
}

const COLS = 120;
const ROWS = 40;

/**
 * A TUI repaints a framebuffer; stripping ANSI out of the raw byte stream turns every
 * repaint into fragments. Feed the stream to a headless xterm instead and read whole
 * rows: lines that scroll into scrollback are final, so they stream out as the agent
 * writes, and the viewport holds whatever the agent is still drawing.
 *
 * Fixed at the pty's own 120x40 — the visible terminal is fitted to the pane and would
 * wrap the rows differently.
 */
export class TranscriptScreen {
  private term: Terminal | null = null;
  private committed = 0;
  private queue: string[] = [];
  private cols = COLS;
  private rows = ROWS;

  async init(): Promise<void> {
    if (this.term) return;
    const { Terminal: Ctor } = await import("@xterm/xterm");
    this.term = new Ctor({ cols: this.cols, rows: this.rows, scrollback: 4000, convertEol: true });
    for (const chunk of this.queue.splice(0)) this.term.write(chunk);
  }

  /** Rows that scrolled out of the viewport since the last call — final text. */
  write(chunk: string): Promise<ScreenRow[]> {
    const term = this.term;
    if (!term) {
      this.queue.push(chunk);
      return Promise.resolve([]);
    }
    return new Promise((resolve) => {
      term.write(chunk, () => {
        const buffer = term.buffer.active;
        const rows: ScreenRow[] = [];
        for (let y = this.committed; y < buffer.baseY; y += 1) rows.push(readRow(buffer.getLine(y)));
        this.committed = buffer.baseY;
        resolve(rows);
      });
    });
  }

  /** Follow the pty's size so wrapped rows join back into the same sentences. */
  resize(cols: number, rows: number): void {
    this.cols = Math.max(20, cols);
    this.rows = Math.max(5, rows);
    this.term?.resize(this.cols, this.rows);
  }

  /** What the agent is drawing right now, still subject to repaint. */
  viewportLines(): ScreenRow[] {
    const term = this.term;
    if (!term) return [];
    const buffer = term.buffer.active;
    const rows: ScreenRow[] = [];
    for (let y = buffer.baseY; y < buffer.baseY + term.rows; y += 1) {
      rows.push(readRow(buffer.getLine(y)));
    }
    return rows;
  }

  dispose(): void {
    this.term?.dispose();
    this.term = null;
    this.queue = [];
    this.committed = 0;
  }
}
