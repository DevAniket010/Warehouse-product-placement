"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Papa from "papaparse";
import { gsap } from "gsap";

const initialGridSize = 11;

export default function Warehouse() {
  const [gridSize] = useState(initialGridSize);
  const [grid, setGrid] = useState([]);
  const [paths, setPaths] = useState([]);
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    const fetchWarehouseLayout = async () => {
      try {
        const response = await axios.get(
          `http://localhost:8000/generate-warehouse?size=${gridSize}`
        );
        setGrid(response.data.layout);
      } catch (error) {
        console.log("Error fetching warehouse layout:", error);
      }
    };

    fetchWarehouseLayout();
  }, [gridSize]);

  const handleAddProduct = () => {
    if (newProduct && newFrequency) {
      const existingProductIndex = products.findIndex(
        (product) => product.name === newProduct
      );

      if (existingProductIndex !== -1) {
        const updatedProducts = [...products];
        updatedProducts[existingProductIndex].frequency = parseInt(
          newFrequency,
          10
        );
        setProducts(updatedProducts);
      } else {
        setProducts((prevProducts) => [
          ...prevProducts,
          { name: newProduct, frequency: parseInt(newFrequency, 10) },
        ]);
      }
      setNewProduct("");
      setNewFrequency("");
    }
  };

  const handleBulkUpload = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newProducts = results.data.map((row) => ({
          name: row.name,
          frequency: parseInt(row.frequency, 10),
        }));

        const updatedProducts = [...products];
        newProducts.forEach((newProduct) => {
          const existingProductIndex = updatedProducts.findIndex(
            (product) => product.name === newProduct.name
          );

          if (existingProductIndex !== -1) {
            updatedProducts[existingProductIndex].frequency +=
              newProduct.frequency;
          } else {
            updatedProducts.push(newProduct);
          }
        });

        setProducts(updatedProducts);
      },
      error: (error) => {
        console.error("Error parsing the CSV file:", error);
      },
    });
  };

  const optimizePlacement = async () => {
    const productFrequencies = products.reduce((acc, product) => {
      acc[product.name] = product.frequency;
      return acc;
    }, {});

    try {
      const response = await axios.post(
        "http://localhost:8000/optimize-placement",
        { product_frequencies: productFrequencies }
      );
      setGrid(response.data.layout);
    } catch (error) {
      console.log("Error optimizing placement:", error);
    }
  };

  const findPaths = async () => {
    if (!selectedProduct) {
      console.log("Please select a product to find its path.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:8000/find-paths", {
        layout: grid,
        product: selectedProduct,
        start: [0, 1], 
      });

      setPaths(response.data.path || []);
      drawPath(response.data.path || []);
      animatePaths(response.data.path || []);
    } catch (error) {
      console.log("Error finding paths:", error);
    }
  };

  const animatePaths = (paths) => {
    const walker = document.createElement("img");
    walker.src = "/walker.png";
    walker.className = "absolute h-14 w-14 z-50";
    const gridContainer = document.querySelector(".grid");
    gridContainer.appendChild(walker);

    paths.forEach((p, index) => {
      const cell = document.querySelector(`#cell-${p[0]}-${p[1]}`);
      if (!cell) return;

      const { left, top, width, height } = cell.getBoundingClientRect();

      let direction = 0;
      if (index > 0) {
        const prevCell = paths[index - 1];
        if (p[0] < prevCell[0]) direction = -180; // Moving up
        if (p[0] > prevCell[0]) direction = 0; // Moving down
        if (p[1] < prevCell[1]) direction = 90; // Moving left
        if (p[1] > prevCell[1]) direction = -90; // Moving right
      }

      gsap.to(walker, {
        x: left - gridContainer.getBoundingClientRect().left + width / 2,
        y: top - gridContainer.getBoundingClientRect().top + height / 2,
        rotation: direction,
        duration: 0.8,
        delay: index * 0.8,
        onComplete: () => {
          if (index === paths.length - 1) {
            setTimeout(() => {
              walker.remove();
            }, 3000);
          }
        },
      });
    });
  };

  const drawPath = (path) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "red"; 
    context.lineWidth = 5;
    context.beginPath();

    path.forEach((point, index) => {
      const cell = document.querySelector(`#cell-${point[0]}-${point[1]}`);
      if (cell) {
        const { left, top, width, height } = cell.getBoundingClientRect();
        const offsetX = left - canvas.getBoundingClientRect().left + width / 2;
        const offsetY = top - canvas.getBoundingClientRect().top + height / 2;

        if (index === 0) {
          context.moveTo(offsetX, offsetY);
        } else {
          context.lineTo(offsetX, offsetY);
        }
      }
    });

    context.stroke();
  };

  // const drawPath = (path) => {
  //   if (!canvasRef.current) return;

  //   const canvas = canvasRef.current;
  //   const context = canvas.getContext("2d");

  //   // Clear previous drawings
  //   context.clearRect(0, 0, canvas.width, canvas.height);

  //   // Validate path data
  //   if (!Array.isArray(path) || path.length === 0) {
  //     console.warn("Invalid or empty path data.");
  //     return;
  //   }

  //   // Match canvas size with grid container
  //   const gridContainer = document.querySelector(".grid");
  //   if (gridContainer) {
  //     canvas.width = gridContainer.offsetWidth;
  //     canvas.height = gridContainer.offsetHeight;
  //   }

  //   context.strokeStyle = "red"; // Set path color
  //   context.lineWidth = 5;
  //   context.beginPath();

  //   path.forEach(([row, col], index) => {
  //     const cell = document.querySelector(`#cell-${row}-${col}`);
  //     if (cell) {
  //       const { left, top, width, height } = cell.getBoundingClientRect();
  //       const gridBounds = gridContainer.getBoundingClientRect();

  //       const offsetX = left - gridBounds.left + width / 2;
  //       const offsetY = top - gridBounds.top + height / 2;

  //       if (index === 0) {
  //         // Start at the first point
  //         context.moveTo(offsetX, offsetY);
  //       } else {
  //         // Draw line to the next point
  //         context.lineTo(offsetX, offsetY);
  //       }
  //     } else {
  //       console.warn(`Cell not found for coordinates (${row}, ${col})`);
  //     }
  //   });

  //   context.stroke();
  // };

  return (
    <div className="bg-gray-200">
      <h1 className="text-4xl font-bold mb-6 text-blue-800 bg-white p-8">
        Warehouse Optimizer
      </h1>

      <div className="p-8">
        <p className="text-2xl px-4">Warehouse Layout</p>
        <div className="grid grid-cols-11 gap-1 p-4 relative">
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 pointer-events-none z-50 w-full h-full"
            width={1841}
            height={572}
          ></canvas>
          {grid.map((rowArr, rowIndex) =>
            rowArr.map((cellValue, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                id={`cell-${rowIndex}-${colIndex}`}
                className={`relative px-4 py-2 ${
                  cellValue === "p" || cellValue === "w" ? "h-[1px]" : ""
                } h-12 text-center font-semibold rounded mt-3 `}
              >
                <div
                  className={`absolute inset-0 top-0 flex justify-center items-center z-10 ${
                    cellValue === "w"
                      ? "bg-amber-900 text-white"
                      : cellValue === "c"
                      ? " bg-slate-300"
                      : cellValue === "p"
                      ? "bg-gray-200"
                      : "bg-green-500 text-white"
                  }`}
                >
                  {cellValue !== "w"
                    ? cellValue === "c"
                      ? ""
                      : cellValue === "p"
                      ? ""
                      : cellValue
                    : "wall"}
                </div>
                <div
                  className={`absolute inset-0 ${
                    cellValue === "w"
                      ? "bg-amber-950"
                      : cellValue === "c"
                      ? " bg-slate-400"
                      : cellValue === "p"
                      ? "bg-gray-200"
                      : "bg-green-600 text-white"
                  }
              rounded -bottom-4 `}
                ></div>
              </button>
            ))
          )}
        </div>

        <div className="flex flex-col lg:flex-row mt-16 gap-8">
          {/* Input Product Frequencies */}
          <section className="flex-1 bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">
              Input Product Frequencies
            </h2>
            <div className="flex items-center mb-6">
              <input
                type="text"
                placeholder="Product Name"
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                className="border p-2 mr-2 rounded-lg flex-1"
              />
              <input
                type="number"
                placeholder="Frequency"
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value)}
                className="border p-2 rounded-lg flex-1"
              />
              <button
                className="ml-2 bg-blue-500 text-white p-2 rounded-lg shadow hover:bg-blue-600 transition"
                onClick={handleAddProduct}
              >
                Add Product
              </button>
            </div>

            {/* Bulk Upload */}
            <div className="mb-6">
              <label htmlFor="csvUpload" className="block font-semibold mb-2">
                Upload CSV for Bulk Products
              </label>
              <input
                type="file"
                id="csvUpload"
                accept=".csv"
                onChange={(e) => handleBulkUpload(e.target.files[0])}
                className="border p-2 rounded-lg w-full"
              />
            </div>

            {/* Display Added Products */}
            {products.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-blue-800 mb-4">
                  Added Products
                </h3>
                <table className="w-full border-collapse border border-gray-300 text-left text-sm">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 p-2">Product</th>
                      <th className="border border-gray-300 p-2">Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, index) => (
                      <tr
                        key={index}
                        className={`${
                          index % 2 === 0 ? "bg-gray-100" : "bg-white"
                        }`}
                      >
                        <td className="border border-gray-300 p-2">
                          {product.name}
                        </td>
                        <td className="border border-gray-300 p-2">
                          {product.frequency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              className="mt-4 bg-green-500 text-white p-2 rounded-lg shadow hover:bg-green-600 transition w-full"
              onClick={optimizePlacement}
            >
              Optimize Placement
            </button>
          </section>

          {/* Path Finder */}
          <section className="flex-1 bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">
              Select Product to Find Path
            </h2>
            <div className="flex items-center mb-6">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="border p-2 rounded-lg flex-1"
              >
                <option value="">Select a product</option>
                {products.map((product, index) => (
                  <option key={index} value={product.name}>
                    {product.name}
                  </option>
                ))}
              </select>
              <button
                className="ml-4 bg-blue-500 text-white p-2 rounded-lg shadow hover:bg-blue-600 transition"
                onClick={findPaths}
              >
                Find Optimal Paths
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
