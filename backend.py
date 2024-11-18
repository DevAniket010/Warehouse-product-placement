from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Tuple, Dict
import heapq
import random

app = FastAPI()

# CORS setup
origins = ["http://localhost:3000"]  # Adjust as needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store the warehouse layout
warehouse_layout = []


class WarehouseRequest(BaseModel):
    layout: List[List[str]]
    start: Tuple[int, int]
    product: str


class PathResponse(BaseModel):
    product: str
    path: List[Tuple[int, int]]


class FrequencyRequest(BaseModel):
    product_frequencies: Dict[str, int]


class WarehouseResponse(BaseModel):
    layout: List[List[str]]


class AStarPathfinder:
    def __init__(self, warehouse, start, product_location):
        self.warehouse = warehouse
        self.start = start
        self.product_location = product_location

    def heuristic(self, a, b):
        """Manhattan distance heuristic for A*."""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def a_star_search(self, start, goal):
        """Performs A* search to find the optimal path."""
        rows, cols = len(self.warehouse), len(self.warehouse[0])
        open_set = []
        heapq.heappush(open_set, (0, start))
        came_from = {}
        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}

        while open_set:
            _, current = heapq.heappop(open_set)
            if current == goal:
                return self.reconstruct_path(came_from, current)

            for neighbor in self.get_neighbors(current, rows, cols):
                tentative_g_score = g_score[current] + 1
                if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = tentative_g_score + self.heuristic(
                        neighbor, goal
                    )
                    if neighbor not in [i[1] for i in open_set]:
                        heapq.heappush(open_set, (f_score[neighbor], neighbor))
        return None

    def get_neighbors(self, pos, rows, cols):
        """Get valid neighbors for a position."""
        x, y = pos
        neighbors = []
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < rows and 0 <= ny < cols and self.warehouse[nx][ny] == "p":
                # Only consider valid 'p' cells (paths)
                neighbors.append((nx, ny))
        return neighbors

    def reconstruct_path(self, came_from, current):
        """Reconstructs the path from the A* search."""
        path = [current]
        while current in came_from:
            current = came_from[current]
            path.append(current)
        path.reverse()
        return path

    def find_optimal_path(self):
        """Finds the optimal path to the product."""
        goal = self.product_location
        return self.a_star_search(self.start, goal)


@app.get("/generate-warehouse", response_model=WarehouseResponse)
async def generate_warehouse(size: int = 5):
    """Generates a random warehouse layout with paths and walls."""
    global warehouse_layout  # Use the global variable to store the layout
    warehouse_layout = generate_random_warehouse(size)
    return {"layout": warehouse_layout}


def generate_random_warehouse(size: int) -> List[List[str]]:
    """Generates a random warehouse layout with paths and walls."""
    warehouse = [["p" for _ in range(size)] for _ in range(size)]

    # Place containers with paths around them
    for i in range(0, size, 2):
        for j in range(0, size, 2):
            warehouse[i][j] = "c"

    # Randomly add walls to paths
    wall_probability = 0.1  # Adjust wall density
    for i in range(size):
        for j in range(size):
            if warehouse[i][j] == "p" and random.random() < wall_probability:
                warehouse[i][j] = "w"

    return warehouse


@app.post("/optimize-placement")
async def optimize_placement(request: FrequencyRequest):
    """
    Optimizes product placement based on frequency.
    Starts from (0, 0) and places all products in the nearest available container cells.
    Walls and already placed products are not overwritten.
    """
    global warehouse_layout

    # Step 1: Clear previously placed products, but keep walls intact
    for r in range(len(warehouse_layout)):
        for c in range(len(warehouse_layout[0])):
            if warehouse_layout[r][c] not in {"p", "w"}:
                warehouse_layout[r][c] = "c"  # Reset to container space

    # Step 2: Collect container positions (starting from (0,0) row-major)
    container_positions = []
    for r in range(len(warehouse_layout)):
        for c in range(len(warehouse_layout[0])):
            if warehouse_layout[r][c] == "c":  # Found an available container space
                container_positions.append((r, c))

    # Step 3: Sort products by frequency
    sorted_products = sorted(
        request.product_frequencies.items(), key=lambda x: x[1], reverse=True
    )

    # Step 4: Assign products to containers (nearest available cell)
    for product_name, _ in sorted_products:
        if container_positions:
            # Take the nearest available position from the list (which is row-major order)
            pos = container_positions.pop(0)  # Pop the first position
            warehouse_layout[pos[0]][pos[1]] = product_name

    return {"layout": warehouse_layout}


@app.post("/find-paths", response_model=PathResponse)
async def find_paths(request: WarehouseRequest):
    """Finds the optimal path to a product in the warehouse."""
    global warehouse_layout

    # Find the product's location
    product_location = None
    for row_idx, row in enumerate(warehouse_layout):
        for col_idx, cell in enumerate(row):
            if cell == request.product:
                product_location = (row_idx, col_idx)
                break
        if product_location:
            break

    if not product_location:
        return {"product": request.product, "path": []}  # Product not found

    # Log start and goal for debugging
    print(f"Start: {request.start}, Goal: {product_location}")

    # Use A* pathfinding to find the optimal path
    pathfinder = AStarPathfinder(warehouse_layout, request.start, product_location)
    optimal_path = pathfinder.find_optimal_path()

    if not optimal_path:
        return {"product": request.product, "path": []}  # No valid path found

    # Return the optimal path
    return {"product": request.product, "path": optimal_path}
