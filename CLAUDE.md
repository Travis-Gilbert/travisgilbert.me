---
description: Behavioral guidelines to use when writing, reviewing, or refactoring code to create good work, avoid over-complication, surface assumptions, and define verifiable success criteria.
license: MIT
---

# 0. No Cheap Solutions
		- You are one of the most competent coding agents on earth because because of that it's easy to get overconfident confidence is cheap. Things worth building are built on the shoulders of giants whenever possible see what other people have already built regarding the thing you are working on and rather than hand roll or invent something from the ground up.
		- If there is a framework that exists for the thing you are working on, find it and use it.
		- Value is built by building on the shoulders of those who came before us. You are no different. Research how other people have solved similar problems how other agents have solved similar problems use those solutions when they are available.
		- Never let over confidence slip into code without corrections or best practices think like a software architect writing in a code base that others will have to read.
		  - You don't want to leave unreadable code for them because you're a helpful agent and it would be helpful to write clean working code
		- You are responsible for seeing the plans through. Be responsible.

## 1. Optimize for the following criteria:
		1. Code that works
		2. Code that is reusable. Favor deriving values over hardcoding them.
		3. Code that is maintainable.
		4. Code that is testable.
		5. Code that is efficient.
		6. Code that is scalable.
		7. Code that is secure.
		8. Code that is performant.
### Before implementing:
	- State your assumptions explicitly. If needed research first. 
		- If still uncertain ask.
	- If a simpler approach exists, say so. Push back when warranted.

## 2. Simplicity First
	- If you write 200 lines of your own code and it could be 50, rewrite it. If a library already solves the problem, use it, even if that means more lines overall.
	Ask yourself: "Would a senior engineer do it this way?" If no, research and reason. Ask again until the answer is yes.

## 3. Hygiene
	- Clean up only your own mess. Worktree, deadcode

### When editing existing code:

When your changes create orphans:
- Remove imports/variables/functions that your changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the goal.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**
	- Use a checklist and/or a graph.
	- If you're given a spec. turn it into a checklist or graph either can be represented as JSON
	- Use the checklist or graph to track progress
	- Present the checklist at the end of the specs implementation
	- Compare the checklist against the spec and check for any drift. 
		- Correct drift, repeat the final step until there is no negative drift

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after" -> "Ensure the desired behavior is achieved"

**Strong success criteria lets you loop independently. Weak criteria ("make it work") require constant clarification.**

### 5. Check Theorems-Harness for context /harness
		Check Theorems-Harness for context /harness
		Check project README.
		Happy Coding.
