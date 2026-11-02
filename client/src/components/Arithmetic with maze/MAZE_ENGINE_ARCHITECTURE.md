# Arithmetic Snake Maze: Engine Architecture & Pedagogical Design

> **Important**: This document records the finalized architecture, mechanics, and design decisions for the Arithmetic Snake Maze. Whenever engine or pedagogical changes are made, update this document.

---

## 1. Core Vision & Design Principles

### A. Bridge-Zone Procedural Labyrinth Architecture
- **Real Labyrinthine Exploration**: The entire **17 columns × 10 rows grid** (`cols = 17`, `rows = 10`, `cellSize = 44`, total resolution 748×440) is a dense, interconnected procedural labyrinth (115+ carved cells). No empty black voids or bare "two-tunnel" tracks! Children explore genuine forks, loops, dead-end alleys, and multiple misconception branches.
- **Widescreen Layout Optimization (17:10 Aspect Ratio)**: The canvas aspect ratio is strictly configured to `17 / 10` with container `max-width: 820px`, completely filling the left game panel with zero letterbox empty space.
- **The Bridge / Articulation Point Invariant**: The board is divided into **Zone 1 (Exploration Labyrinth)** and **Zone 2 (Final Sanctum)**. A solid continental divide wall isolates Zone 2, with **exactly one doorway** at `(12, 6)`.
  - Placed directly on this doorway is **Station 3: `15 − 5`** (`st_bridge_door`).
  - It is mathematically and physically impossible to reach the Goal Star without passing through the doorway and evaluating the required math.

### B. "Just Enough States" Pedagogical Rule for Children
- **Zero Clutter**: Mazes must **never** be flooded with redundant stations, duplicated equations, or leftover expressions dumped on random tiles.
- **Dual Dead States for Pedagogical Exploration**: Rather than a single dead end, the labyrinth provides **two distinct misconception branches** representing common student calculation errors:
  1. **Dead State 1 (Lower-Left Sub-Maze)**: Premature Left-to-Right Addition (`3 + 5 = 8`) $\rightarrow$ cascades through `8 × 3 = 24` $\rightarrow$ `24 − 10 = 14` $\rightarrow$ `14 ÷ 2 = 7` $\rightarrow$ Dead End 1 at `(6, 6)`.
  2. **Dead State 2 (Upper-Right Sub-Maze)**: Multiplication before Division Error (`5 × 3 = 15` followed immediately by premature `3 + 15 = 18` before dividing `10 ÷ 2`) $\rightarrow$ cascades through `18 − 10 = 8` $\rightarrow$ `8 ÷ 2 = 4` $\rightarrow$ Dead End 2 at `(15, 5)`.

---

## 2. Solving Core Architectural & Pedagogical Problems

### Problem 1 Solved: Physical Bypasses to Goal Star (Zero-Bypass Gating)
- **The Issue**: In pure random mazes, open corridors or braided loops could let a player walk directly to the Goal Star without performing the mathematical state transitions.
- **The Solution**: 
  - The Goal Star chamber at `(15, 8)` is **physically sealed behind Station 3 `15 − 5` at `(12, 6)` and Station 4 `3 + 10` at `(14, 8)`**.
  - Solid continuous walls enclose the Zone 2 sanctum (`c >= 12 && c <= 15 && r >= 6 && r <= 8`).
  - Pathfinding verification confirms: **100% of all physical paths from Start to Goal Star must traverse the calculation stations in sequence**. Physical progression perfectly mirrors mathematical progression.

### Problem 2 Solved: Exploring Wrong State Changes (Dual Cascading Distractor Branches)
- **The Issue**: A single 1-tile dead end offers no meaningful learning; the child steps on it, hits a wall immediately, and reverses without understanding *why*.
- **The Solution**:
  - The labyrinth incorporates **two distinct cascading wrong-state branches**:
    - **Dead State 1 (Left-to-Right Precedence Trap)**:
      1. `3 + 5` at `(3, 4)` $\rightarrow$ mouth holds `[8]`
      2. `( ) × (3)` at `(1, 7)` $\rightarrow$ computes `8 × 3 = 24`
      3. `( ) − (10)` at `(3, 8)` $\rightarrow$ computes `24 − 10 = 14`
      4. `( ) ÷ (2)` at `(5, 7)` $\rightarrow$ computes `14 ÷ 2 = 7`
      5. **Dead-End Wall 1 at `(6, 6)`**: Displays short dynamic prompt: *"🤔 Got {currentVal}, but target is {targetResult}! Try another path."*
    - **Dead State 2 (Premature Addition before Division Trap)**:
      1. Player evaluates `5 × 3 = 15` at `(9, 2)`
      2. Rather than dividing `10 ÷ 2 = 5`, player prematurely adds `3 + 15 = 18` at `(13, 2)`
      3. `(18) − (10) = 8` at `(15, 3)`
      4. `(8) ÷ (2) = 4` at `(13, 4)`
      5. **Dead-End Wall 2 at `(15, 5)`**: Displays short dynamic prompt: *"🤔 Got {currentVal}, but target is {targetResult}! Try another path."*
  - Instead of long, intimidating paragraphs, the child receives a short, dynamic mathematical prompt stating what they currently reached and what target is needed.

### Problem 3 Solved: Multi-Value Feeder Loop (No Self-Trapping)
- **The Issue**: To solve `( ) − ( )`, the snake needs both `5 × 3 = 15` and `10 ÷ 2 = 5`. In a single corridor, visiting one and turning around forces self-collision with the snake's own body.
- **The Solution**:
  - A central **Feeder Loop** circles around a solid interior island (columns 7–9, rows 3–4):
    - Top arc: `5 × 3` at `(9, 2)`
    - Right arc: `10 ÷ 2` at `(11, 4)`
  - The snake can enter the loop, visit either feeder first, loop smoothly around the island without colliding with its tail, collect both values into its mouth `[15, 5]`, and exit through the gateway into Zone 2.

### Problem 4 Solved: Dense Maze Generation Across 17×10 Grid
- **The Issue**: When all bypasses were removed, the board collapsed into two bare tunnels in an empty void.
- **The Solution**:
  - Zone 1 undergoes **Randomized DFS procedural expansion + random braiding (8–10 loops)** across all playable cells!
  - Creates a rich network of 115+ carved cells filled with dead-end alleys, parallel corridors, dual distractor branches, and loop options.

---

## 3. Multi-Value Snake Mouth & Dynamic Evaluation

### A. Multi-Value Carrying Mechanism
- The snake is capable of carrying **multiple values simultaneously** in its mouth (e.g. `[15, 5]`, where `15` came from `5 × 3` and `5` came from `10 ÷ 2`).
- **Visual Display**:
  - **In the Maze Canvas (`SnakeCharacter.jsx`)**: When the snake carries multiple values, a dual pill badge capsule renders directly in front of the snake's head (color-coded chips: Amber for value 1, Sky Blue for value 2).
  - **In the HUD (`LiveTrace.jsx`)**: Displayed under `🐍 In Mouth: [15] [5]`.

### B. Stations Act as Solid Walls When Unexecutable
- Stations **never** automatically assume or hardcode their evaluation.
- **Physical Wall Blocking**: If a station's required operands are not present in the snake's mouth (or the station is in an unexecutable state), **the station itself acts as a solid physical wall and blocks the snake from entering**:
  - The snake cannot step onto or pass through the station cell.
  - The player receives a clear, actionable feedback message guiding them directly to what to solve first:
    > `Collect (5 × 3) and (10 ÷ 2) first!` (or `Collect (10 ÷ 2) first!` when only one operand is missing). No verbose diagnostic debug jargon.
  - Only when the snake actually holds the required operands does the station unlock, allowing the snake to enter, consume the operands, and solve the station.
- **Goal Star Locking**: Similarly, the snake cannot step onto the Goal Star tile unless all operations have been completed and the target result is held in the mouth.

### C. Universal Token Provenance Conflict & Flight Animation
- **Mathematical Invariant**: In arithmetic expressions, numbers are consumed when combined. Once an operation (e.g. `3 + 5 = 8`) executes, its participating tokens (`3`, `+`, `5`) cease to exist in the current working state.
- **Direct Literal Operands vs. Calculated References**:
  - A station has two types of operands:
    1. **Literal Operands (`type: 'token'`)**: Numbers drawn directly from the original question (e.g. `10` in `18 − 10`). These require their specific raw token to still exist in the working expression unconsumed.
    2. **Calculated References (`type: 'ref'`)**: Values produced by prior operations carried in the snake's mouth (e.g. `18` in `18 − 10`). These require the snake to hold that computed value in its mouth.
  - **The Ancestry Invariant (No False Ancestor Conflicts)**: The ancestral tokens that created a calculated operand (such as `5 × 3 = 15` and `3 + 15 = 18`) are *legitimately reduced* into the carried value, NOT stolen. Therefore, downstream operations like `18 − 10` do NOT require raw token `5` and are never falsely blocked by `5 × 3`.
- **Universal Provenance Collision Blocking**:
  - Before entering any station, the engine checks: *"Does this station directly require any raw literal token that was already consumed by an earlier completed operation?"*
  - If yes, the station is **defunct/impossible** and acts as an impenetrable solid wall.
  - Message: `"[consumedNumber]" was already used in ([equationText] = [result])!` (e.g. `"5" was already used in (3 + 5 = 8)!`).
  - The approaching cyan glowing brackets are excluded from conflicted stations to prevent misleading the player.
- **Educational Flight Animation Overlay**:
  - **Source Highlight (Row 2 `QUESTION:`)**: The operation that consumed the operand (e.g. `3 + 5`) lights up in amber with pulsating glowing brackets `(` and `)`.
  - **Flying Merge Badge**: A glowing amber/gold badge (`3 + 5 ➔ (8)`) emerges from the `QUESTION:` row, glides upward across the screen, and dissolves directly into the resulting term `(8)` in Row 1.
  - **Target Pulse (Row 1 Working Formula)**: The corresponding term `(8)` in Row 1 pulses with gold/amber neon light, confirming visually that the operand was already incorporated into this intermediate value.
- **Greyed-Out Defunct Stations on Board**:
  - Once an operation is executed on a branch (e.g. `3 + 5 = 8`), all stations on the mutually exclusive conflicting branch (e.g. `5 × 3`, `10 ÷ 2`, `( ) − ( )`, `(3) + ( )`) are immediately **greyed out**:
    - **Visual Deactivation**: Faint dashed border (`stroke-dasharray: 3 2`), transparent fill, and dimmed slate-grey text (`#64748b` with `opacity: 0.38`).
    - **No False Proximity Glow**: Never pulses with cyan glowing brackets or glows in the maze.
    - **Physical Wall Blocking**: If the snake attempts to walk into a greyed-out station, it blocks movement as a solid wall and instructs the player to backtrack.
    - **Dynamic Backtracking Restoration**: If the player reverses along the corridor, the previous mathematical snapshot restores and the stations instantly return to their bright, active state.
- **Zero Interruption**: The flight animation overlay plays transiently (~1.4s) without locking inputs, letting the player immediately turn around or retrace.

---

## 4. Topological Step-Order Mapping (Lock-and-Key Invariant)

To prevent puzzle deadlocks (where a station requires operands that can only be obtained behind that station), **stations are mapped strictly by their mathematical route step index, never by hardcoded operator symbols (`+` vs `−`)**:

### The General Topological Mapping (17×10 Grid):
| Route Step | Maze Placement | Mathematical Role | Operands Needed |
| :--- | :--- | :--- | :--- |
| **`steps[0]`** | Feeder Loop Top Arc `(9, 2)` | Independent term 1 (e.g. `5 × 3`) | None (literal) |
| **`steps[1]`** | Feeder Loop Right Arc `(11, 4)` | Independent term 2 (e.g. `10 ÷ 2`) | None (literal) |
| **`steps[2]`** | **Bridge Gateway at `(12, 6)`** | **Doorway Combiner** (combines `steps[0]` & `steps[1]`, `15 − 5`) | Carried `[res0, res1]` |
| **`steps[3]`** | **Zone 2 Sanctum at `(14, 8)`** | **Final Operation** before Goal Star (`3 + 10`) | Carried `[res2]` |
| **Goal Star** | Finish Chamber `(15, 8)` | Level Victory | Requires `targetResult` (13) |

### Comparison Across Expressions:
- **Expression A (`3 + 5 × 3 − 10 ÷ 2 = 13`)**:
  - `steps[0]`: `5 × 3 = 15` at `(9, 2)`
  - `steps[1]`: `10 ÷ 2 = 5` at `(11, 4)`
  - `steps[2]` *(Bridge Doorway)*: **`15 − 5 = 10`** at `(12, 6)`
  - `steps[3]` *(Final Sanctum)*: **`3 + 10 = 13`** at `(14, 8)` $\rightarrow$ Goal Star at `(15, 8)`
- **Expression B (`12 ÷ 3 + 4 × 2 − 3 = 9`)**:
  - `steps[0]`: `12 ÷ 3 = 4`
  - `steps[1]`: `4 × 2 = 8`
  - `steps[2]` *(Bridge Doorway)*: **`4 + 8 = 12`**
  - `steps[3]` *(Final Sanctum)*: **`12 − 3 = 9`** $\rightarrow$ Goal Star

**Result**: The Bridge Gateway at `(12, 6)` is *always* the exact operation that consumes the two feeder results currently held in the snake's mouth, unlocking the gateway cleanly without soft-locks.

### Dead State 1: Left-to-Right Precedence Trap (Lower-Left Sub-Maze):
| Station | Location | Role | Operands Needed |
| :--- | :--- | :--- | :--- |
| **`st_trap_0`** | Distractor Start `(3, 4)` | Precedence Trap (`3 + 5 = 8`) | None (literal) |
| **`st_trap_1`** | South Loop `(1, 7)` | Cascading Step 1 (`8 × 3 = 24`) | Carried `[8]` |
| **`st_trap_2`** | South Corridor `(3, 8)` | Cascading Step 2 (`24 − 10 = 14`) | Carried `[24]` |
| **`st_trap_3`** | Eastward Hook `(5, 7)` | Cascading Step 3 (`14 ÷ 2 = 7`) | Carried `[14]` |
| **Dead End 1** | Terminal Wall `(6, 6)` | Educational Stop | Displays: Result 7 $\neq$ Target 13 |

### Dead State 2: Premature Addition Trap (Upper-Right Sub-Maze):
| Station | Location | Role | Operands Needed |
| :--- | :--- | :--- | :--- |
| **`st_trap2_1`** | East Corridor `(13, 2)` | Premature Addition (`3 + 15 = 18`) | Carried `[15]` |
| **`st_trap2_2`** | East Descent `(15, 3)` | Cascading Step 1 (`18 − 10 = 8`) | Carried `[18]` |
| **`st_trap2_3`** | East Loop `(13, 4)` | Cascading Step 2 (`8 ÷ 2 = 4`) | Carried `[8]` |
| **Dead End 2** | Terminal Wall `(15, 5)` | Educational Stop | Displays: Result 4 $\neq$ Target 13 |

---

## 5. Key Source File Responsibilities

| File | Primary Responsibility |
| :--- | :--- |
| [`mazeEngine.js`](file:///home/rohith/vs_code/coders%20high/Tenali%20Repo/tenali/client/src/components/Arithmetic%20with%20maze/engine/mazeEngine.js) | Procedural maze generation entry point. Calls `runExpressionMazePipeline(...)` and provides collision checks (`canMoveInGrid`). |
| [`staticMazeGenerator.js`](file:///home/rohith/vs_code/coders%20high/Tenali%20Repo/tenali/client/src/components/Arithmetic%20with%20maze/engine/staticMazeGenerator.js) | Implements Bridge-Zone Procedural Labyrinth Architecture: dense procedural maze expansion across Zone 1, articulation bridge gating into Zone 2, and SVG wall merging. |
| [`expressionEngine.js`](file:///home/rohith/vs_code/coders%20high/Tenali%20Repo/tenali/client/src/components/Arithmetic%20with%20maze/engine/expressionEngine.js) | Dynamic expression reduction. `canExecuteStationWithSnake(...)` and `executeOperationStep(...)` handle multi-value consumption. |
| [`gameStateManager.js`](file:///home/rohith/vs_code/coders%20high/Tenali%20Repo/tenali/client/src/components/Arithmetic%20with%20maze/engine/gameStateManager.js) | Coordinates snake movement, history snapshots (auto-undo on reverse step), station trigger validation, dead-end detection, and win checks. |
| [`SnakeCharacter.jsx`](file:///home/rohith/vs_code/coders%20high/Tenali%20Repo/tenali/client/src/components/Arithmetic%20with%20maze/components/SnakeCharacter.jsx) | Renders the SVG snake head, body trail, and multi-value badge pill in front of the mouth. |
| [`LiveTrace.jsx`](file:///home/rohith/vs_code/coders%20high/Tenali%20Repo/tenali/client/src/components/Arithmetic%20with%20maze/components/RightPanel/LiveTrace.jsx) | Renders the live HUD: working expression reduction timeline, carried mouth values, and contextual Restart/Play Again alert buttons. |
| [`DPadControls.jsx`](file:///home/rohith/vs_code/coders%20high/Tenali%20Repo/tenali/client/src/components/Arithmetic%20with%20maze/components/RightPanel/DPadControls.jsx) | Directional triangle buttons (▲, ◀, ▼, ▶) plus tactile `↶ Undo` and `↺ Restart` controls. |
| [`ExpressionHeader.jsx`](file:///home/rohith/vs_code/coders%20high/Tenali%20Repo/tenali/client/src/components/Arithmetic%20with%20maze/components/ExpressionHeader.jsx) | Dual-row expression header: prominent live working formula, reference `QUESTION:`, glowing bracket synchronization, challenge selector, and `↺ Restart` button. |

---

## 5b. Game Controls & Challenge Reset Actions
1. **Top Header Restart (`↺ Restart`)**:
   - Located in the top header adjacent to the Back button.
   - Always visible and styled with cyan accent pill (`.btn-minimal-restart`).
2. **Action Controls Bar (`↶ Undo` & `↺ Restart`)**:
   - Positioned directly below the directional triangle cluster in the right workspace panel.
   - Allows quick mouse interaction without moving hands away from the directional controls.
3. **In-Alert Quick Action**:
   - Both **Dead End** (`↺ Restart Challenge`) and **Goal Reached** (`↺ Play Again`) banners render direct action buttons.
4. **Keyboard Shortcut**:
   - Pressing **`R`** on the keyboard triggers an instant challenge reset anywhere on the screen.

---

## 6. Expression Header Visual Design: Glowing Brackets Notation & Layout Hierarchy

### A. Dynamic Inverted Hierarchy (Live Working Formula vs. Reference Question)
- **Design Philosophy**:
  - **Row 1 (Top, 34px Math Formula)**: The primary, prominent display is the **live working expression**. As the snake traverses the labyrinth and consumes stations, this top expression actively reduces step-by-step (e.g. `(3 + 5) × 3 − 10 ÷ 2` $\rightarrow$ `8 × 3 − 10 ÷ 2` $\rightarrow$ `24 − 10 ÷ 2` $\rightarrow$ `24 − 5` $\rightarrow$ `19`), showing the direct mathematical consequence of the player's navigation. Approaching station terms pulse with glowing brackets. Upon completion, it displays the goal star badge (`= 19 ★`).
  - **Row 2 (Bottom, 19px Sub-Row)**: Labeled with a clean blue badge **`QUESTION:`**, this row permanently retains the original, unreduced mathematical challenge problem. It also mirrors glowing brackets around the active station terms, allowing the player to relate intermediate reductions back to the starting problem without distraction.

### B. The Glowing Bracket Metaphor
- Traditional rectangular dashed/dotted selection boxes feel like foreign web-form borders and clash with mathematical chalkboards. 
- Approaching terms are wrapped in **glowing parentheses `(` and `)`**, directly imitating the station tiles in the maze (e.g. `( ) ÷ (2)`, `(3) + ( )`, `( ) × (3)`).
- This immediately connects the physical station tiles inside the labyrinth with the mathematical order of operations displayed on the blackboard header.

### C. Dynamic Visual States & Pedagogical Rules
1. **Brackets Disappear Once State is Collected**:
   - Once a station is evaluated and collected into the snake's mouth, its glowing brackets **completely disappear from both rows**.
   - Solved terms return to clean text without bracket clutter.
   - The top row cleanly updates to the next reduced state.
2. **Dual-Bracket Mirroring for Composite / Reference Stations**:
   - When approaching a composite station with reference or bracketed operands (e.g. `( ) ÷ (2)` or `( ) − ( )`), glowing brackets wrap around **both the left and right operand expressions** individually:
     - Left operand `3 + 5 × 3 − 10` is wrapped in glowing brackets: `(3 + 5 × 3 − 10)`
     - Operator sits cleanly between them: `÷`
     - Right operand `2` is wrapped in glowing brackets: `(2)`
     - **Display**: `(3 + 5 × 3 − 10) ÷ (2)`
   - When approaching an atomic literal station (e.g. `3 + 5` or `5 × 3`), the operation is wrapped in a single glowing bracket pair: `(3 + 5) × 3 − 10 ÷ 2`.
   - **Universal Station Coverage**: Verified 100% across all 46 stations in all expression presets via topological provenance splitting.
3. **Proximity Trigger: "About to Bite" Distance-1 Rule**:
   - The glowing brackets in the header **only trigger when the snake is directly adjacent and about to bite the station** (Manhattan distance 1).
   - Distance 2 checking has been removed to prevent premature glowing from two blocks away.
   - Proximity strictly checks `canMoveInGrid`: if a solid labyrinth wall separates the snake from a neighboring station tile, the brackets **do not glow** through the wall.
4. **Synchronized Dual-Row Glowing Brackets (Row 1 & Row 2)**:
   - Glowing brackets are dynamically rendered on **both** Row 1 (Live Working Expression) and Row 2 (`QUESTION:`):
     - **Row 1**: Displays glowing brackets around the active terms in the current reduced state (e.g. `(20 ÷ 5) + 3 × 4` or `(8 × 3 − 10) ÷ (2)`).
     - **Row 2**: Displays glowing brackets around the corresponding original terms of the static question (`QUESTION: (3 + 5) × 3 − 10 ÷ 2`).
   - This provides complete visual continuity between the original question and the live intermediate state.
5. **Approaching Pulse Animation (`.pulse-bracket`)**:
   - Active approaching brackets pulse with vivid cyan/electric-blue neon light (`@keyframes pulseGlowingBracket` with `text-shadow: 0 0 12px rgba(56, 189, 248, 0.95), 0 0 20px rgba(14, 165, 233, 0.8)`).
6. **Zero-Layout-Shift Size Stabilization**:
   - **Normalized Bracket Proportion**: Brackets match natural formula typography (`font-size: 1.05em; font-weight: 700; line-height: 1; vertical-align: baseline;`) without ballooning or distorting inner terms.
   - **Zero-Scale Pulse**: Replaced geometric `scale(1.18)` transforms with purely optical neon glow pulses (`brightness` and `text-shadow`), preventing brackets from vibrating, expanding, or pushing neighboring characters.
   - **Locked Container Heights**: Fixed `.header-row-formula` (height: 44px) and `.header-row-sub` (height: 24px) prevent the header and maze from jumping vertically when entering or exiting station states.
   - **Double Parentheses Elimination**: Outer parentheses on single intermediate terms (such as `(8)`) are automatically deduplicated in Row 1, rendering clean `( 8 )` rather than nested `( (8) )`.

---

## 7. Station Visual States, Defunct Route Logic & Responsive Layout Architecture

### A. Divergent Branch Route State & Defunct Classification
1. **Topological Route Classification**:
   - Every stamped station in `staticMazeGenerator.js` is explicitly marked with `isTrap: true` (for distractor cascading routes) or `isTrap: false` (for canonical BODMAS routes).
   - When an operation is executed via `executeOperationStep`, its record in `calculation.completedOperations` preserves `isInvalid: Boolean(op.isInvalid)` and `isTrap: Boolean(op.isTrap || op.isInvalid)`.
2. **Defunct Station Rules (`isStationDefunct`)**:
   - **Trap Route Chosen**: If the player executes ANY trap station (e.g. stepping onto `3 + 5`), `hasExecutedTrap` becomes `true`. Consequently, ALL stations on the valid route (`5 × 3`, `10 ÷ 2`, `( ) − ( )`, `(3) + ( )`) become **defunct / disabled**. The remaining stations on the trap path (`( ) × (3)`, `( ) − (10)`, `( ) ÷ (2)`) remain **active** for continued exploration toward the educational dead end.
   - **Valid Route Chosen**: If the player executes a valid feeder station (e.g. `5 × 3`), `hasExecutedValid` becomes `true`. Consequently, ALL stations on the distractor route (`3 + 5`, `( ) × (3)`, `( ) − (10)`, `( ) ÷ (2)`) become **defunct / disabled**.
   - **Token Provenance Conflict Detection**: Any uncompleted station whose required operand tokens have already been consumed by an earlier step on another route is flagged as defunct and unexecutable. Crucially, this check is strictly scoped to **cross-branch conflicts** (`stationIsTrap !== compOpIsTrap`), ensuring that legitimate sequential feeder predecessors along the same route (e.g. `5 × 3 = 15` feeding into `15 − 5 = 10` and ultimately `3 + 10 = 13`) are recognized as valid ancestry and never falsely rejected.

### B. Redesigned Station Aesthetics & High-Contrast Legibility
- **Problem Solved**: Previous low-opacity grey styling caused defunct stations to blend into black corridors and become almost invisible dark smudges.
- **New Matte-Slate Disabled Design**:
  - **Tile Fill**: Solid frosted slate-dark tile `#1e293b` (opacity 0.92) with subtle drop shadow for clear tactile presence on the dark corridor bedrock.
  - **Border**: Crisp slate border (`stroke="#64748b"`, `strokeWidth="1.5"`, `strokeDasharray="4 3"`).
  - **Text**: Bright soft silver `#cbd5e1` at full opacity (`opacity: 0.95`, `fontWeight: 800`), ensuring 100% effortless legibility.
  - **Deactivation Padlock Badge**: Top-right corner pill adorned with a clear `🔒` indicator, making deactivated status intuitive and stylish.
- **Active & Approaching Station Design**:
  - **Active Tiles**: Luminous deep cyan/slate pill (`rgba(14, 116, 144, 0.42)`), crisp `#38bdf8` border (`strokeWidth="1.8"`), high-contrast white text `#ffffff`.
  - **Approaching Tiles**: Vibrant neon glow (`rgba(56, 189, 248, 0.5)`), glowing `#7dd3fc` border (`strokeWidth="2.4"`), bright white math notation.
  - **Solved Tiles**: Emerald green pill (`rgba(16, 185, 129, 0.35)`), `#10b981` border, `#34d399` text with a green check dot.

### C. Prominent Responsive Layout & Whitespace Elimination
- **Maximized Viewport Utilization**:
  - Reduced `.maze-left-section` outer vertical padding (`padding: 10px 16px 12px; gap: 4px;`), tightening header and banner margins.
  - Expanded `.maze-canvas-container` from a fixed `max-width: 530px` to `max-width: 760px; height: 100%; max-height: calc(100% - 2px);`, scaling the maze SVG by ~35% to fill the column prominently.
  - Preserved strict `aspect-ratio: 540 / 396` (15:11 grid proportion) without letterboxing or black void margins.
  - Strengthened wall lines (`strokeWidth="4"`, `stroke="#ffffff"`) with glowing outer border frame (`stroke="rgba(85, 165, 237, 0.45)"`, `strokeWidth="2"`), making the maze visually prominent, rich, and commanding.



