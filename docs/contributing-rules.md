# Rule authoring

A useful rule answers four questions:

1. What exact text or doctor check identifies the problem?
2. Which platforms are affected?
3. What safe next steps help distinguish local configuration from an upstream bug?
4. Is there a public upstream issue or documentation link?

Prefer exact strings for distinctive errors and regex only when the variable portion is unavoidable. Keep actions read-only where possible. Do not recommend deleting databases, lowering OS security, disabling endpoint protection, or bypassing sandboxing as an automatic first step.
