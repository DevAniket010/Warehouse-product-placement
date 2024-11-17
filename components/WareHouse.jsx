"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { gsap } from "gsap";
const initialGridSize = 10; // Define initial grid size

export default function Warehouse() {
  const [gridSize] = useState(initialGridSize);
  const [grid, setGrid] = useState([]);
  const [paths, setPaths] = useState([]);
  const [products, setProducts] = useState([]); // Array to hold all product inputs dynamically
  const [newProduct, setNewProduct] = useState(""); // For adding a new product
  const [newFrequency, setNewFrequency] = useState(""); // For adding a new frequency
  const [selectedProduct, setSelectedProduct] = useState(""); // To hold selected product

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

  const handleAddProduct = () => {
    if (newProduct && newFrequency) {
      // Check if product already exists
      const existingProductIndex = products.findIndex(
        (product) => product.name === newProduct
      );

      if (existingProductIndex !== -1) {
        // Update frequency of existing product
        const updatedProducts = [...products];
        updatedProducts[existingProductIndex].frequency = parseInt(
          newFrequency,
          10
        );
        setProducts(updatedProducts);
      } else {
        // Add a new product to the list
        setProducts((prevProducts) => [
          ...prevProducts,
          { name: newProduct, frequency: parseInt(newFrequency, 10) },
        ]);
      }

    }
  };

  const optimizePlacement = async () => {
    // Create a structured payload for product frequencies
    const productFrequencies = products.reduce((acc, product) => {
      acc[product.name] = product.frequency;
      return acc;
    }, {});

    try {
      const response = await axios.post(
        "http://localhost:8000/optimize-placement",
        {
          product_frequencies: productFrequencies,
        }
      );
      setGrid(response.data.layout);
      setNewProduct(""); // Clear input field
      setNewFrequency(""); // Clear input field
    } catch (error) {
      console.error("Error optimizing placement:", error.response.data);
    }
  };

  const findPaths = async () => {
    if (!selectedProduct) {
      console.error("Please select a product to find its path.");
      return;
    }

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

    if (!productsLocationMap[selectedProduct]) {
      console.error("Selected product not found in the warehouse.");
      return;
    }

    try {
      // Adjusting the payload to match backend expectations
      const response = await axios.post("http://localhost:8000/find-paths", {
        layout: grid,
        start: start,
        product: selectedProduct, // Send only the selected product
      });

      setPaths([response.data]); // Wrap response data in an array
      animatePaths([response.data]); // Animate paths after fetching them
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
    <div className=" bg-gray-200 ">
      <h1 className="text-4xl font-bold mb-6 text-blue-800 bg-white p-8">
        Warehouse Optimizer
      </h1>

      {/* Warehouse Grid */}
      <div className="p-8">
        <p className="text-2xl px-4">Warehouse Layout</p>
        <div className="grid grid-cols-10 gap-3 p-4">
          {grid.map((rowArr, rowIndex) =>
            rowArr.map((cellValue, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                id={`cell-${rowIndex}-${colIndex}`}
                className={`relative px-4 py-2 h-12 text-center font-semibold rounded mt-3`}
              >
                <div
                  className={`absolute inset-0 top-0 flex justify-center items-center z-10 ${
                    cellValue === "W"
                      ? "bg-amber-900 text-white"
                      : cellValue !== "0"
                      ? "bg-green-500 text-white"
                      : "bg-slate-300"
                  }`}
                >
                  {cellValue !== "W"
                    ? cellValue == "0"
                      ? ""
                      : cellValue
                    : "wall"}
                </div>
                <div
                  className={`absolute inset-0 ${
                    cellValue === "W"
                      ? "bg-amber-950"
                      : cellValue !== "0"
                      ? "bg-green-600 text-white"
                      : "bg-slate-400"
                  }
              rounded -bottom-4 `}
                ></div>
              </button>
            ))
          )}
        </div>

        {/* Warehouse Text for Real-World Look */}
        <div className="mt-6 text-gray-600">
          <p className="italic">
            Imagine a bustling warehouse with numerous products stacked on
            shelves. The system will optimize product placements based on their
            frequency of use and ensure that the paths followed by the workers
            are as efficient as possible. The layout consists of aisles (denoted
            by &quot;0&quot;), walls (&quot;W&quot;), and the products located
            in various positions within the warehouse.
          </p>
        </div>

        {/* Product Frequency Input Section */}
        <div className="flex mt-16 gap-8">
          <div className="flex-1 bg-white p-8 rounded-lg">
            <h2 className="text-2xl font-semibold text-blue-800">
              Input Product Frequencies
            </h2>
            <div className="flex items-center my-4">
              <input
                type="text"
                placeholder="Product Name"
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                className="border p-2 mr-2 rounded-lg"
              />
              <input
                type="number"
                placeholder="Frequency"
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value)}
                className="border p-2 rounded-lg"
              />
              <button
                className="ml-2 bg-blue-500 text-white p-2 rounded-lg shadow hover:bg-blue-600 transition"
                onClick={handleAddProduct}
              >
                Add Product
              </button>
            </div>

            {/* Display Added Products */}
            {products.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-blue-800">
                  Added Products
                </h3>
                {products.map((product, index) => (
                  <div key={index} className="flex items-center mb-2">
                    <span className="mr-2">
                      {product.name} - {product.frequency} in stock
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Optimize Placement Button */}
            <button
              className="mt-4 bg-green-500 text-white p-2 rounded-lg shadow hover:bg-green-600 transition"
              onClick={optimizePlacement}
            >
              Optimize Placement
            </button>
          </div>

          <div className="flex-1 w-full h-fit bg-white p-8 rounded-lg">
            {/* Select Product for Pathfinding */}
            <div className="">
              <h2 className="text-2xl font-semibold text-blue-800">
                Select Product to Find Path
              </h2>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="border p-2 rounded-lg w-[70%]"
              >
                <option value="">Select a product</option>
                {products.map((product, index) => (
                  <option key={index} value={product.name}>
                    {product.name}
                  </option>
                ))}
              </select>

              {/* Find Paths Button */}
              <button
                className="mt-4 ml-4 bg-blue-500 text-white p-2 rounded-lg shadow hover:bg-blue-600 transition"
                onClick={findPaths}
              >
                Find Optimal Paths
              </button>
            </div>

            {/* Display Paths and Weights */}
            <div className="mt-6">
              {paths.map((pathObj, index) => (
                <div key={index} className="mb-6">
                  <h3 className="text-2xl font-semibold text-blue-700">
                    {pathObj.product} Path
                  </h3>
                  <div className="flex flex-wrap mt-4">
                    {pathObj.path.map((p, pathIndex) => (
                      <div
                        key={pathIndex}
                        className="h-8 flex items-center justify-center border p-2 m-1 bg-gray-200 rounded-md"
                      >
                        ({p[0]}, {p[1]})
                        <span className="ml-2 text-sm text-gray-500">
                          {pathObj?.weights && pathObj?.weights[pathIndex] ? (
                            <>{pathObj.weights[pathIndex]} kg</>
                          ) : (
                            "No weight data"
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
