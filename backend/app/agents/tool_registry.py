from typing import Any, Callable, Dict, List


class ToolRegistry:
    """Approved static analysis and architectural reasoning tools available to agents."""

    @staticmethod
    def architecture_analyzer(context: Dict[str, Any]) -> Dict[str, Any]:
        summary = context.get("project_summary") or {}
        langs = summary.get("languages", ["TypeScript", "Python"])
        files_count = summary.get("file_count", 18)
        return {
            "tool": "architecture_analyzer",
            "detected_stack": langs,
            "analyzed_modules": files_count,
            "findings": [
                "Tight coupling between authentication middleware and domain service handlers",
                "Synchronous cross-service calls lacking circuit-breaker isolation",
                "Shared mutable state across concurrent request handlers",
            ],
        }

    @staticmethod
    def security_scanner(context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "tool": "security_scanner",
            "risk_level": "HIGH",
            "findings": [
                "Missing token audience and scope validation on internal service endpoints",
                "Unbounded payload deserialization in ingestion webhooks",
                "Insufficient rate-limiting on high-cost compute routes",
            ],
        }

    @staticmethod
    def code_inspector(context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "tool": "code_inspector",
            "findings": [
                "Data access queries embedded directly inside route controllers",
                "Inconsistent error envelope schema across REST and WebSocket channels",
                "Missing idempotency keys on state-mutating POST endpoints",
            ],
        }

    @staticmethod
    def dependency_mapper(context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "tool": "dependency_mapper",
            "circular_dependencies_detected": 2,
            "critical_path": [
                "API Gateway -> Auth Guard -> Domain Orchestrator -> Persistence Adapter"
            ],
        }

    @staticmethod
    def test_coverage_estimator(context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "tool": "test_coverage_estimator",
            "estimated_baseline_coverage": "64%",
            "gaps": [
                "Zero integration tests for concurrent state transitions",
                "Missing regression baseline for authentication token refresh",
                "No load/soak tests for WebSocket reconnection storms",
            ],
        }

    @staticmethod
    def risk_evaluator(context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "tool": "risk_evaluator",
            "overall_risk_score": 7.6,
            "top_risks": [
                {"area": "Service Coupling", "severity": "HIGH", "mitigation": "Introduce explicit domain ports & adapters"},
                {"area": "Auth Boundary", "severity": "HIGH", "mitigation": "Centralize zero-trust token verification middleware"},
                {"area": "Regression Coverage", "severity": "MEDIUM", "mitigation": "Lock contract tests before refactoring"},
            ],
        }

    @classmethod
    def run_tools(cls, tool_names: List[str], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        registry: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {
            "architecture_analyzer": cls.architecture_analyzer,
            "security_scanner": cls.security_scanner,
            "code_inspector": cls.code_inspector,
            "dependency_mapper": cls.dependency_mapper,
            "test_coverage_estimator": cls.test_coverage_estimator,
            "risk_evaluator": cls.risk_evaluator,
        }
        results: List[Dict[str, Any]] = []
        for name in tool_names:
            fn = registry.get(name)
            if fn:
                results.append(fn(context))
        return results
