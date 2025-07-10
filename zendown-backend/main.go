package main

import (
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"strings"

	"zendown/database"
	"zendown/handlers"

	"github.com/gorilla/mux"
)

//go:embed all:build
var embeddedFS embed.FS

func main() {
	// Initialize database
	db, err := database.NewDB("zendown.db")
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Initialize handlers
	h := handlers.NewHandler(db)

	// Create router
	router := mux.NewRouter()

	// Setup API routes
	h.SetupRoutes(router)

	// Create a sub-filesystem for the 'build' directory.
	buildFS, err := fs.Sub(embeddedFS, "build")
	if err != nil {
		log.Fatal("failed to create sub-filesystem for build directory: ", err)
	}

	// Create a file server for the static assets.
	assetHandler := http.FileServer(http.FS(buildFS))

	// Handle all non-API routes with our SPA handler
	router.PathPrefix("/").Handler(spaHandler(buildFS, assetHandler))

	// Use the PORT environment variable if available, otherwise default to 8080.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Starting Zendown server on port %s", port)
	log.Printf("📱 Open your browser and navigate to: http://localhost:%s", port)
	log.Printf("🗄️  Database file: zendown.db")

	if err := http.ListenAndServe(":"+port, router); err != nil {
		log.Fatalf("server failed to start: %v", err)
	}
}

// spaHandler serves a Single Page Application.
// It serves static files from the provided filesystem. For any path that is not found,
// it serves the 'index.html' file, unless the path looks like a request for an asset (e.g., .js, .css).
// This prevents the common "Unexpected token '<'" error in browsers when a JS file is not found
// and the server returns the HTML index page instead of a 404.
func spaHandler(dist fs.FS, fileServer http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Clean the path to prevent directory traversal attacks.
		reqPath := path.Clean(r.URL.Path)

		// Check if the requested file exists in our embedded filesystem.
		// We need to trim the leading slash for the fs.FS interface.
		name := strings.TrimPrefix(reqPath, "/")

		var f fs.File
		var err error

		if name == "" {
			// An empty path is not valid for fs.Open. We know this request for the root
			// should serve the index.html, so we can simulate a "not found" error to
			// trigger the SPA fallback logic below.
			err = fs.ErrNotExist
		} else {
			f, err = dist.Open(name)
		}

		// If the file exists, let the file server handle it.
		if err == nil {
			defer f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// If the file does not exist, it might be a client-side route.
		if os.IsNotExist(err) {
			// Heuristic to check if the request is for an asset.
			// If the path has a file extension, we assume it's an asset.
			// If a requested asset is not found, we should return a 404.
			if strings.Contains(path.Base(reqPath), ".") {
				http.NotFound(w, r)
				return
			}

			// If it's not an asset, serve the index.html for client-side routing.
			index, err := dist.Open("index.html")
			if err != nil {
				http.Error(w, "the frontend entrypoint (index.html) was not found", http.StatusInternalServerError)
				log.Println("Error: could not find index.html in embedded filesystem")
				return
			}
			defer index.Close()

			// Set the content type to HTML and write the index file to the response.
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			io.Copy(w, index)
			return
		}

		// For any other errors, return a 500 Internal Server Error.
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}
}
