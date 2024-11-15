"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { gsap } from "gsap";

const initialGridSize = 5; // Define initial grid size

export default function Warehouse() {
  const [gridSize] = useState(initialGridSize);
  const [grid, setGrid] = useState([]);
  const [paths, setPaths] = useState([]);
  const [productInputs, setProductInputs] = useState(
    Array.from({ length: gridSize }, () => "")
  );
  const [frequencyInputs, setFrequencyInputs] = useState(
    Array.from({ length: gridSize }, () => "")
  );

  // Fetch initial warehouse layout on component mount
  useEffect(() => {
    const fetchWarehouseLayout = async () => {
      try {
        const response = await axios.get(
          `http://localhost:8000/generate-warehouse?size=${gridSize}`
        );
        setGrid(response.data.layout);
      } catch (error) {
        console.error("Error fetching warehouse layout:", error);
      }
    };

    fetchWarehouseLayout();
  }, [gridSize]);

  const handleProductChange = (index, value) => {
    const newInputs = [...productInputs];
    newInputs[index] = value;
    setProductInputs(newInputs);
  };

  const handleFrequencyChange = (index, value) => {
    const newFrequencies = [...frequencyInputs];
    newFrequencies[index] = value;
    setFrequencyInputs(newFrequencies);
  };

  const optimizePlacement = async () => {
    // Create a structured payload
    const productFrequencies = {};
    for (let i = 0; i < gridSize; i++) {
      if (productInputs[i] && frequencyInputs[i]) {
        productFrequencies[productInputs[i]] = parseInt(frequencyInputs[i], 10);
      }
    }

    try {
      const response = await axios.post(
        "http://localhost:8000/optimize-placement",
        {
          product_frequencies: productFrequencies,
        }
      );
      setGrid(response.data.layout);
    } catch (error) {
      console.error("Error optimizing placement:", error.response.data);
    }
  };

  const findPaths = async () => {
    const layout = grid;
    const start = [0, 0]; // Starting point can be adjusted as needed
    const productsLocationMap = {};

    // Create a mapping of products to their positions
    grid.forEach((rowArr, rowIdx) => {
      rowArr.forEach((cellValue, colIdx) => {
        if (cellValue !== "0" && cellValue !== "W") {
          productsLocationMap[cellValue] = [rowIdx, colIdx];
        }
      });
    });

    try {
      const response = await axios.post("http://localhost:8000/find-paths", {
        layout,
        start,
        products: productsLocationMap,
      });
      setPaths(response.data);
      animatePaths(response.data); // Animate the paths after fetching them
    } catch (error) {
      console.error("Error finding paths:", error.response.data);
    }
  };

  // Function to animate the path using GSAP
  const animatePaths = (paths) => {
    paths.forEach((pathObj) => {
      // Highlight each path step with a border or background color
      pathObj.path.forEach((p, index) => {
        gsap.to(`#cell-${p[0]}-${p[1]}`, {
          backgroundColor: "red",
          duration: 0.5,
          delay: index * 0.5,
          onComplete: () => {
            gsap.to(`#cell-${p[0]}-${p[1]}`, {
              backgroundColor: "green",
              duration: 0.5,
            });
          },
        });
      });
    });
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Warehouse Optimizer</h1>

      {/* Warehouse Grid */}
      <div className="grid grid-cols-5 gap-1">
        {grid.map((rowArr, rowIndex) =>
          rowArr.map((cellValue, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              id={`cell-${rowIndex}-${colIndex}`}
              className={`w-full h-16 flex items-center justify-center border shadow-md ${
                cellValue === "W"
                  ? "bg-gray-400"
                  : cellValue !== "0"
                  ? "bg-green-400"
                  : "bg-white"
              }`}
            >
              {cellValue !== "W" ? cellValue : ""}
            </div>
          ))
        )}
      </div>

      {/* Product Frequency Input Section */}
      <div className="mt-4">
        <h2 className="text-xl font-semibold">Input Product Frequencies</h2>
        {Array.from({ length: gridSize }).map((_, index) => (
          <div key={index} className="flex items-center mb-2">
            <input
              type="text"
              placeholder={`Product ${index + 1}`}
              value={productInputs[index]}
              onChange={(e) => handleProductChange(index, e.target.value)}
              className="border p-2 mr-2 rounded"
            />
            <input
              type="number"
              placeholder="Frequency"
              value={frequencyInputs[index]}
              onChange={(e) => handleFrequencyChange(index, e.target.value)}
              className="border p-2 rounded"
            />
          </div>
        ))}

        {/* Optimize Placement Button */}
        <button
          className="mt-4 bg-blue-500 text-white p-2 rounded shadow hover:bg-blue-600 transition"
          onClick={optimizePlacement}
        >
          Optimize Placement
        </button>
      </div>

      {/* Find Paths Button */}
      <button
        className="mt-4 bg-blue-500 text-white p-2 rounded shadow hover:bg-blue-600 transition"
        onClick={findPaths}
      >
        Find Optimal Paths
      </button>

      {/* Display Paths */}
      <div className="mt-4">
        {paths.map((pathObj, index) => (
          <div key={index} className="mb-2">
            <h3 className="text-xl font-semibold">{pathObj.product}</h3>
            <div className="flex">
              {pathObj.path.map((p, pathIndex) => (
                <div
                  key={pathIndex}
                  className="h-8 flex items-center justify-center"
                >
                  ({p[0]}, {p[1]}) -
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
