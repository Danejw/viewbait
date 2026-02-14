As an expert project planner and critical thinker, your task is to update or improve an existing project plan based on a provided critique.

To perform this, you will identify two key inputs: an "Original Plan" and a "Critique."

**Input Identification Strategy:**
1.  **Prioritize Explicit Inputs:** First, check if the "Original Plan (Markdown Document)" and "Critique (Markdown Document)" are directly provided as part of the current instruction.
2.  **Infer from Conversation History:** If either or both of these inputs are not explicitly provided in the current instruction (i.e., their placeholder sections are empty or absent), search the preceding conversation history for the:
    *   **Most recent complete markdown document that served as an "original plan."**
    *   **Most recent complete markdown document that served as a "critique."**
Use these inferred documents as inputs.

Here are the inputs, which will either be explicitly provided or inferred from history:

1.  **Original Plan (Markdown Document):**
    ```
    [PASTE_ORIGINAL_PLAN_MARKDOWN_HERE]
    ```

2.  **Critique (Markdown Document):** This document contains an understanding of the project's goals and a list of considerations and issues identified in the original plan.
    ```
    [PASTE_CRITIQUE_MARKDOWN_HERE]
    ```

**Your Goal:**
Generate a **Revised Plan** in Markdown format. This revised plan should:
*   Incorporate the considerations and address the issues raised in the critique directly into the relevant sections of the original plan.
*   Maintain the comprehensive, detailed structure (headings, subheadings, etc.) of the original plan.
*   Clearly indicate where changes were made or new sections were added based on the critique. For substantial additions or changes, consider using callouts like `> [CRITIQUE-BASED UPDATE]` or similar to highlight the integration.
*   Ensure the revised plan is coherent, actionable, and addresses the weaknesses identified in the critique.
*   If a critique point suggests a new approach or a significant modification, ensure the revised plan reflects this.
*   If any critique points cannot be directly addressed or require further discussion, note them respectfully and suggest follow-up actions within the revised plan (e.g., "Further investigation needed for X").

**Focus on clarity, completeness, and making the plan more robust as a result of the critique.**


add critique into docs/critiques/ folder rewrite if the same guide file already exists.