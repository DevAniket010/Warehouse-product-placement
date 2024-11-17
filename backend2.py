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
    products: Dict[str, Tuple[int, int]]


class PathResponse(BaseModel):
    product: str
    path: List[Tuple[int, int]]


class FrequencyRequest(BaseModel):
    product_frequencies: Dict[str, int]


class WarehouseResponse(BaseModel):
    layout: List[List[str]]


class AStarPathfinder:
    def _init_(self, warehouse, start, products):
        self.warehouse = warehouse
        self.start = start
        self.products = products
        self.rows = len(warehouse)
        self.cols = len(warehouse[0])
        self.cache = {}  # Cache to store previously computed paths

    def heuristic(self, a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def a_star_search(self, start, goal):
        if (start, goal) in self.cache:  # Use cached path if available
            return self.cache[(start, goal)]

        open_set = []
        heapq.heappush(open_set, (0, start))
        came_from = {}
        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}

        while open_set:
            _, current = heapq.heappop(open_set)
            if current == goal:
                path = self.reconstruct_path(came_from, current)
                self.cache[(start, goal)] = path  # Cache the result
                return path

            for neighbor in self.get_neighbors(current):
                tentative_g_score = g_score[current] + 1
                if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = tentative_g_score + self.heuristic(
                        neighbor, goal
                    )
                    if neighbor not in [i[1] for i in open_set]:
                        heapq.heappush(open_set, (f_score[neighbor], neighbor))

        return None  # No valid path found

    def get_neighbors(self, pos):
        x, y = pos
        neighbors = []
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if (
                0 <= nx < self.rows
                and 0 <= ny < self.cols
                and self.warehouse[nx][ny] != "W"
            ):
                neighbors.append((nx, ny))
        return neighbors

    def reconstruct_path(self, came_from, current):
        path = [current]
        while current in came_from:
            current = came_from[current]
            path.append(current)
        path.reverse()
        return path

    def find_optimal_paths(self):
        paths = {}
        for product, location in self.products.items():
            path = self.a_star_search(self.start, location)
            if path:
                paths[product] = path
        return paths


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
    global warehouse_layout

    # Sort products by frequency
    sorted_products = sorted(
        request.product_frequencies.items(), key=lambda x: x[1], reverse=True
    )

    # Place products in clusters near the center of the warehouse
    center = (len(warehouse_layout) // 2, len(warehouse_layout[0]) // 2)
    available_positions = [
        (r, c)
        for r in range(len(warehouse_layout))
        for c in range(len(warehouse_layout[0]))
        if warehouse_layout[r][c] == "0"
    ]

    # Sort available positions by proximity to the center
    available_positions.sort(key=lambda pos: abs(pos[0] - 0) + abs(pos[1] - 0))

    for product_name, _ in sorted_products:
        if available_positions:
            pos = available_positions.pop(0)
            warehouse_layout[pos[0]][pos[1]] = product_name
        else:
            break  # No more available spaces

    return {"layout": warehouse_layout}


@app.post("/find-paths", response_model=List[PathResponse])
async def find_paths(request: WarehouseRequest):
    global warehouse_layout  # Use the global variable for finding paths

    pathfinder = AStarPathfinder(warehouse_layout, request.start, request.products)
    optimal_paths = pathfinder.find_optimal_paths()
    return [
        {"product": product, "path": path} for product, path in optimal_paths.items()
    ]


# To run the server use: uvicorn filename:app --reload
