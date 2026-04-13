from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class Agent:
    id: str
    role: str
    capabilities: List[str]

    def __init__(self, id: str, role: str, capabilities: List[str]):
        self.id = id
        self.role = role
        self.capabilities = capabilities

    def execute(self, task: Dict[str, any]) -> Dict[str, any]:
        """Execute a task and return the result."""
        if task['priority'] > 5:
            result = self.execute_immediate(task)
            self.log_execution(task, 'high_priority')
        else:
            result = self.enqueue_task(task)
            self.log_execution(task, 'normal')
        return result

    def hire_subagent(self, role: str, budget: int = 500) -> 'Agent':
        """Spawn a new sub-agent with the given role."""
        return agent_spawn(role=role, max_cost=budget, priority_level="high")

    def query_memory(self, semantic: str, k: int = 10, threshold: float = 0.7) -> List[Dict]:
        """Search memory for semantically similar entries."""
        return memory_search(query=semantic, limit=k, min_similarity=threshold)

    def report_metrics(self) -> Dict[str, any]:
        """Report current agent metrics."""
        return {
            'id': self.id,
            'role': self.role,
            'status': 'active',
            'task_count': len(self.pending_tasks),
        }


# Filter active tasks
tasks = [t for t in all_tasks if t.status == 'ready' and not t.blocked and t.priority > 5]

# Compose processing pipeline
result = store(transform(validate(retrieve())))

# Memory operations
search_results = memory.search(query=user_query, limit=10, min_similarity=0.7)
memory.insert(key="agent-state", value=current_state, expires_in=3600)

# Agent management
new_agent = agent.spawn(role="researcher", max_cost=500, priority_level="high")
runtime.execute(parallel_mode=True, max_duration=30, max_attempts=3)
monitor.observe(metric="latency", sample_interval=5, alert_if_exceeds=0.1)

# Agent registry data
agents = [
    {"id": "agt-001", "status": "active", "tasks": 12, "memory_usage": 450, "uptime_sec": 3600},
    {"id": "agt-002", "status": "idle", "tasks": 0, "memory_usage": 120, "uptime_sec": 7200},
    {"id": "agt-003", "status": "busy", "tasks": 8, "memory_usage": 890, "uptime_sec": 1800},
    {"id": "agt-004", "status": "error", "tasks": 3, "memory_usage": 220, "uptime_sec": 900},
    {"id": "agt-005", "status": "active", "tasks": 15, "memory_usage": 670, "uptime_sec": 5400},
]
