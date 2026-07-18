# Project Design Document

> This document tracks design decisions made during conversations.
> Updated automatically by the `design-tracker` skill.

## Overview

<!-- Project overview goes here -->

## Architecture

<!-- Architecture diagram and description goes here -->

### Agent Roles

| Agent | Role | Responsibilities |
|-------|------|------------------|
| | | |

## Implementation Plan

### Patterns & Approaches

| Pattern | Purpose | Notes |
|---------|---------|-------|
| | | |

### Libraries & Roles

| Library | Role | Version | Notes |
|---------|------|---------|-------|
| | | | |

### Key Decisions

| Decision | Rationale | Alternatives Considered | Date |
|----------|-----------|------------------------|------|
| Keep the parent sea edge set and label it "Common routes"; store boss dialogue on nodes | Parent edges remain required for display/editing and backward compatibility. Node-level dialogue remains available across base and submap scopes. | Removing the base set; encoding dialogue in `meta` | 2026-07-18 |
| Represent landing points with a dedicated `landing` node type and derive their flag marker from the type | Landing and supply points need distinct semantics; air bases must not receive flags. | A generic per-node `hasFlag` field | 2026-07-18 |
| | | | |

## TODO

- [ ]

## Open Questions

- [ ]

## Changelog

| Date | Changes |
|------|---------|
| 2026-07-18 | Documented submap parent-edge semantics, node flags, and boss dialogue. |
| 2026-07-18 | Replaced generic flags with a dedicated landing-point type. |
| | Initial |
