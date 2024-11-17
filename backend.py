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
    product: str  # Changed to accept a single product


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
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def a_star_search(self, start, goal):
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
        x, y = pos
        neighbors = []
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < rows and 0 <= ny < cols and self.warehouse[nx][ny] != "W":
                neighbors.append((nx, ny))
        return neighbors

    def reconstruct_path(self, came_from, current):
        path = [current]
        while current in came_from:
            current = came_from[current]
            path.append(current)
        path.reverse()
        return path

    def find_optimal_path(self):
        # Use only one product's location for pathfinding
        goal = self.product_location
        return self.a_star_search(self.start, goal)


@app.get("/generate-warehouse", response_model=WarehouseResponse)
async def generate_warehouse(size: int = 5):
    """Generates a random warehouse layout with walls."""
    global warehouse_layout  # Use the global variable to store the layout
    warehouse_layout = generate_random_warehouse(size)
    return {"layout": warehouse_layout}


def generate_random_warehouse(size: int) -> List[List[str]]:
    """Generates a random warehouse layout with walls."""
    warehouse_layout = []

    for _ in range(size):
        row = []
        for _ in range(size):
            if random.random() < 0.3:  # Adjust density of walls here (30% chance)
                row.append("W")  # Wall
            else:
                row.append("0")  # Empty space
        warehouse_layout.append(row)

    return warehouse_layout


@app.post("/optimize-placement")
async def optimize_placement(request: FrequencyRequest):
    global warehouse_layout  # Use the global variable for placement

    # Clear the previously placed products (keeping walls intact)
    for row in range(len(warehouse_layout)):
        for col in range(len(warehouse_layout[row])):
            if warehouse_layout[row][col] != "W":  # Don't clear walls
                warehouse_layout[row][col] = "0"  # Reset to empty space

    # Sort products by frequency in descending order
    sorted_products = sorted(
        request.product_frequencies.items(), key=lambda x: x[1], reverse=True
    )

    # Place products in available spaces without overwriting walls
    for product_name, _ in sorted_products:
        placed = False
        for idx in range(len(warehouse_layout) * len(warehouse_layout[0])):
            row = idx // len(warehouse_layout)
            col = idx % len(warehouse_layout[0])

            # Check if the space is empty and not a wall before placing the product
            if warehouse_layout[row][col] == "0":
                warehouse_layout[row][
                    col
                ] = product_name  # Place product based on frequency
                placed = True
                break  # Stop placing after finding an empty spot

    return {"layout": warehouse_layout}


@app.post("/find-paths", response_model=PathResponse)
async def find_paths(request: WarehouseRequest):
    global warehouse_layout  # Use the global variable for finding paths

    # Extracting the product's location from the layout.
    product_location = None

    for row_idx in range(len(warehouse_layout)):
        for col_idx in range(len(warehouse_layout[row_idx])):
            if warehouse_layout[row_idx][col_idx] == request.product:
                product_location = (row_idx, col_idx)
                break

    if not product_location:
        return {
            "product": request.product,
            "path": [],
            "weights": [],
            "total_weight": 0,
        }  # Product not found

    # Use A* pathfinding to find the optimal path.
    pathfinder = AStarPathfinder(warehouse_layout, request.start, product_location)
    optimal_path = pathfinder.find_optimal_path()

    # Calculate the path weights (g_scores)
    path_weights = []
    total_weight = 0

    for idx in range(len(optimal_path) - 1):
        current = optimal_path[idx]
        next_step = optimal_path[idx + 1]

        # Assuming each move has a weight of 1, but you can customize this based on grid contents
        # Here, we can check if a path goes through an obstacle, adding higher weight for obstacles.
        if (
            warehouse_layout[next_step[0]][next_step[1]] == "obstacle"
        ):  # Example check for obstacle
            weight = 5  # Assume a higher cost for obstacles
        else:
            weight = 1  # Default cost

        path_weights.append(weight)
        total_weight += weight

    return {
        "product": request.product,
        "path": optimal_path or [],
        "weights": path_weights,
        "total_weight": total_weight,
    }  # Return weights and total weight along with the path


# To run the server use `uvicorn filename:app --reload`
