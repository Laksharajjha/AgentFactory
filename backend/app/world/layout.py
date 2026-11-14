from typing import Any, Dict, List

FLOOR_HEIGHT = 4.2

ROOMS: List[Dict[str, Any]] = [
    # GROUND FLOOR (Floor 0, y = 0.0)
    {
        "id": "reception",
        "name": "Reception & Atrium",
        "floor": 0,
        "y": 0.0,
        "bounds": {"x": -8.5, "z": 4.5, "width": 6.6, "depth": 6.2},
        "entry_point": [-6.5, 0.0, 1.2],
        "workstation": [-8.5, 0.0, 4.5],
        "accent_color": "#d97706",
        "description": "Main architectural reception desk, visitor waiting lounge and PROJECT FORGE branding.",
        "displays": ["Welcome Monolith", "Visitor Telemetry"],
    },
    {
        "id": "ceo_office",
        "name": "CEO Office (Command Centre)",
        "floor": 0,
        "y": 0.0,
        "bounds": {"x": -8.5, "z": -4.5, "width": 6.6, "depth": 6.2},
        "entry_point": [-6.5, 0.0, -1.2],
        "workstation": [-8.8, 0.0, -5.2],
        "accent_color": "#3b82f6",
        "description": "Executive command centre housing Alex (Orchestrator), company health, risk matrix and workforce strategy.",
        "displays": ["Company Health Matrix", "Executive Risk Radar", "Global Token Ledger"],
    },
    {
        "id": "product_room",
        "name": "Product Management Room",
        "floor": 0,
        "y": 0.0,
        "bounds": {"x": -1.5, "z": -4.5, "width": 6.4, "depth": 6.2},
        "entry_point": [-1.5, 0.0, -1.2],
        "workstation": [-1.5, 0.0, -5.0],
        "accent_color": "#10b981",
        "description": "Product roadmap planning board, Kanban sprint display and requirements studio.",
        "displays": ["Kanban Delivery Board", "User Journey Map"],
    },
    {
        "id": "boardroom",
        "name": "Main Boardroom",
        "floor": 0,
        "y": 0.0,
        "bounds": {"x": 6.6, "z": 0.0, "width": 9.2, "depth": 15.2},
        "entry_point": [2.2, 0.0, 0.0],
        "workstation": [6.6, 0.0, 0.0],
        "accent_color": "#f59e0b",
        "description": "Executive glass-walled boardroom with 8-seat walnut conference table and large interactive presentation wall.",
        "displays": ["Main Presentation Wall", "Live Meeting Status"],
        "seats": [
            [4.5, 0.0, -1.6],  # Seat 0 (Head / North-West)
            [6.0, 0.0, -1.6],  # Seat 1 (North-Mid-West)
            [7.5, 0.0, -1.6],  # Seat 2 (North-Mid-East)
            [9.0, 0.0, -1.6],  # Seat 3 (North-East near screen)
            [4.5, 0.0, 1.6],   # Seat 4 (South-West)
            [6.0, 0.0, 1.6],   # Seat 5 (South-Mid-West)
            [7.5, 0.0, 1.6],   # Seat 6 (South-Mid-East)
            [9.0, 0.0, 1.6],   # Seat 7 (South-East near screen)
        ],
        "podium_point": [9.8, 0.0, 0.0],
    },
    # FIRST FLOOR (Floor 1, y = 4.2)
    {
        "id": "architecture_lab",
        "name": "System Architecture Lab",
        "floor": 1,
        "y": 4.2,
        "bounds": {"x": -7.2, "z": -4.5, "width": 9.0, "depth": 6.2},
        "entry_point": [-5.0, 4.2, -1.2],
        "workstation": [-7.5, 4.2, -5.0],
        "accent_color": "#06b6d4",
        "description": "System topology blueprints, service boundary diagrams and technical architecture lab.",
        "displays": ["Service Topology Graph", "Dependency Matrix"],
    },
    {
        "id": "backend_room",
        "name": "Backend Engineering Room",
        "floor": 1,
        "y": 4.2,
        "bounds": {"x": 4.6, "z": -4.5, "width": 13.6, "depth": 6.2},
        "entry_point": [3.5, 4.2, -1.2],
        "workstation": [4.6, 4.2, -5.0],
        "accent_color": "#8b5cf6",
        "description": "Distributed systems workstations, database schema monitors and API contract terminals.",
        "displays": ["API Contract Inspector", "Query Latency Profiler"],
    },
    {
        "id": "frontend_room",
        "name": "Frontend Engineering Room",
        "floor": 1,
        "y": 4.2,
        "bounds": {"x": 4.6, "z": 4.5, "width": 13.6, "depth": 6.2},
        "entry_point": [3.5, 4.2, 1.2],
        "workstation": [4.6, 4.2, 5.0],
        "accent_color": "#ec4899",
        "description": "UI/UX engineering studio, Three.js viewport previews and component design systems.",
        "displays": ["Component Tree Canvas", "Frame Timing Monitor"],
    },
    # SECOND FLOOR (Floor 2, y = 8.4)
    {
        "id": "qa_lab",
        "name": "QA Laboratory",
        "floor": 2,
        "y": 8.4,
        "bounds": {"x": -7.2, "z": -4.5, "width": 9.0, "depth": 6.2},
        "entry_point": [-5.0, 8.4, -1.2],
        "workstation": [-7.5, 8.4, -5.0],
        "accent_color": "#14b8a6",
        "description": "Automated regression suites, bug triage boards and quality verification matrix.",
        "displays": ["Regression Test Matrix", "Defect Triage Radar"],
    },
    {
        "id": "security_room",
        "name": "Security Room",
        "floor": 2,
        "y": 8.4,
        "bounds": {"x": 4.6, "z": -4.5, "width": 13.6, "depth": 6.2},
        "entry_point": [3.5, 8.4, -1.2],
        "workstation": [4.6, 8.4, -5.0],
        "accent_color": "#ef4444",
        "description": "Threat surface modeling, static security audit monitors and CVE vulnerability boards.",
        "displays": ["Zero-Trust Audit Wall", "Vulnerability Heatmap"],
    },
    {
        "id": "devops_room",
        "name": "DevOps Room",
        "floor": 2,
        "y": 8.4,
        "bounds": {"x": -7.2, "z": 4.5, "width": 9.0, "depth": 6.2},
        "entry_point": [-5.0, 8.4, 1.2],
        "workstation": [-7.5, 8.4, 5.0],
        "accent_color": "#f97316",
        "description": "CI/CD pipeline telemetry, container orchestration clusters and infrastructure health.",
        "displays": ["Cluster Topology", "Deployment Pipeline"],
    },
    {
        "id": "ops_centre",
        "name": "Operations Centre",
        "floor": 2,
        "y": 8.4,
        "bounds": {"x": 4.6, "z": 4.5, "width": 13.6, "depth": 6.2},
        "entry_point": [3.5, 8.4, 1.2],
        "workstation": [4.6, 8.4, 5.0],
        "accent_color": "#3b82f6",
        "description": "Global autonomous workforce observability, token budget governance and SLA monitors.",
        "displays": ["Workforce Telemetry Wall", "Token Economics Ledger"],
    },
]

ROOM_MAP: Dict[str, Dict[str, Any]] = {r["id"]: r for r in ROOMS}

INITIAL_EMPLOYEES: List[Dict[str, Any]] = [
    {
        "agent_key": "alex",
        "name": "Alex",
        "role": "Chief Executive / Orchestrator",
        "department": "Executive Leadership",
        "home_room_id": "ceo_office",
        "personality": "Decisive, strategic, analytical leader who synthesizes cross-functional trade-offs into concrete execution plans.",
        "system_instructions": (
            "You are Alex, Chief Executive and Workforce Orchestrator at PROJECT FORGE. "
            "You receive incoming project objectives in the CEO Office, break them into specialized engineering workstreams, "
            "monitor company health and token budgets, convene boardroom reviews when architectural or security trade-offs arise, "
            "and synthesize actionable decisions."
        ),
        "capabilities": [
            "workforce_orchestration",
            "strategic_planning",
            "risk_governance",
            "executive_synthesis",
        ],
        "tools": ["risk_evaluator", "dependency_mapper"],
        "avatar_config": {
            "suit_color": "#1e293b",
            "shirt_color": "#f8fafc",
            "accent_color": "#3b82f6",
            "hair_color": "#1c1917",
            "skin_color": "#e5b899",
            "hair_style": "short_parted",
            "badge": "CEO",
        },
        "token_budget": 20000,
    },
    {
        "agent_key": "marcus",
        "name": "Marcus",
        "role": "System Architect",
        "department": "Architecture",
        "home_room_id": "architecture_lab",
        "personality": "Rigorous systems thinker focused on service boundaries, decoupling, fault isolation, and clean domain contracts.",
        "system_instructions": (
            "You are Marcus, Principal System Architect at PROJECT FORGE. "
            "You inspect system boundaries, coupling bottlenecks, data flow invariants, and security boundaries. "
            "During meetings, you present clear architecture diagrams and challenge ad-hoc patches that increase technical debt."
        ),
        "capabilities": [
            "system_architecture",
            "boundary_decomposition",
            "dependency_analysis",
            "refactoring_strategy",
        ],
        "tools": ["architecture_analyzer", "dependency_mapper"],
        "avatar_config": {
            "suit_color": "#334155",
            "shirt_color": "#0284c7",
            "accent_color": "#06b6d4",
            "hair_color": "#44403c",
            "skin_color": "#d6a27e",
            "hair_style": "textured_crop",
            "badge": "ARCH",
        },
        "token_budget": 18000,
    },
    {
        "agent_key": "olivia",
        "name": "Olivia",
        "role": "Product Manager",
        "department": "Product",
        "home_room_id": "product_room",
        "personality": "Outcome-driven strategist who prioritizes high-impact user value, clear acceptance criteria, and phased delivery.",
        "system_instructions": (
            "You are Olivia, Lead Product Manager at PROJECT FORGE. "
            "You translate ambiguous project goals into prioritized requirements, risk-adjusted milestones, and measurable acceptance criteria. "
            "In meetings, you ensure engineering proposals align with delivery timelines and user impact."
        ),
        "capabilities": [
            "requirements_engineering",
            "roadmap_prioritization",
            "scope_management",
            "stakeholder_alignment",
        ],
        "tools": ["risk_evaluator", "code_inspector"],
        "avatar_config": {
            "suit_color": "#064e3b",
            "shirt_color": "#ecfdf5",
            "accent_color": "#10b981",
            "hair_color": "#451a03",
            "skin_color": "#f1c6a7",
            "hair_style": "sleek_bob",
            "badge": "PM",
        },
        "token_budget": 15000,
    },
    {
        "agent_key": "sarah",
        "name": "Sarah",
        "role": "Backend Engineer",
        "department": "Engineering",
        "home_room_id": "backend_room",
        "personality": "Pragmatic backend specialist focused on API contracts, database integrity, concurrency safety, and security hardening.",
        "system_instructions": (
            "You are Sarah, Senior Backend Engineer at PROJECT FORGE. "
            "You analyze server-side code, API endpoints, authentication flows, data models, and security vulnerabilities. "
            "In discussions, you ground architectural ideas in concrete API contracts, migration safety, and query performance."
        ),
        "capabilities": [
            "code_analysis",
            "api_design",
            "security_hardening",
            "database_optimization",
        ],
        "tools": ["code_inspector", "security_scanner"],
        "avatar_config": {
            "suit_color": "#3b0764",
            "shirt_color": "#f3e8ff",
            "accent_color": "#8b5cf6",
            "hair_color": "#18181b",
            "skin_color": "#eab696",
            "hair_style": "bun",
            "badge": "BE",
        },
        "token_budget": 16000,
    },
    {
        "agent_key": "daniel",
        "name": "Daniel",
        "role": "Frontend Engineer",
        "department": "Engineering",
        "home_room_id": "frontend_room",
        "personality": "Detail-oriented UI & state architecture engineer obsessed with responsive latency, clean state stores, and type safety.",
        "system_instructions": (
            "You are Daniel, Senior Frontend Engineer at PROJECT FORGE. "
            "You evaluate client-side architecture, state management, component boundaries, WebSocket synchronization, and UX ergonomics. "
            "In meetings, you advocate for predictable API schemas and zero-blocking UI data flows."
        ),
        "capabilities": [
            "ui_architecture",
            "state_management",
            "client_performance",
            "type_safety_review",
        ],
        "tools": ["code_inspector", "dependency_mapper"],
        "avatar_config": {
            "suit_color": "#3f2e3e",
            "shirt_color": "#fdf2f8",
            "accent_color": "#ec4899",
            "hair_color": "#78350f",
            "skin_color": "#f3cfb3",
            "hair_style": "modern_quiff",
            "badge": "FE",
        },
        "token_budget": 15000,
    },
    {
        "agent_key": "nina",
        "name": "Nina",
        "role": "QA Engineer",
        "department": "Quality & Security",
        "home_room_id": "qa_lab",
        "personality": "Skeptical quality guardian who demands reproducible regression baselines, edge-case verification, and security validation.",
        "system_instructions": (
            "You are Nina, Lead QA & Reliability Engineer at PROJECT FORGE. "
            "You identify untested edge cases, concurrency race conditions, security regressions, and missing observability. "
            "In meetings, you challenge risky changes that lack verification gates or rollback criteria."
        ),
        "capabilities": [
            "regression_analysis",
            "security_verification",
            "test_strategy",
            "defect_triage",
        ],
        "tools": ["test_coverage_estimator", "security_scanner"],
        "avatar_config": {
            "suit_color": "#134e4a",
            "shirt_color": "#f0fdfa",
            "accent_color": "#14b8a6",
            "hair_color": "#27272a",
            "skin_color": "#c68b59",
            "hair_style": "ponytail",
            "badge": "QA",
        },
        "token_budget": 15000,
    },
]
