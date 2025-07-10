package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"zendown/database"
	"zendown/semware"

	"github.com/gorilla/mux"
)

type Handler struct {
	db      *database.DB
	semware *semware.Client
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{
		db:      db,
		semware: semware.NewClient(),
	}
}

type CreateNoteRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type UpdateNoteRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

func (h *Handler) CreateNote(w http.ResponseWriter, r *http.Request) {
	var req CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		req.Title = "Untitled Note"
	}

	note, err := h.db.CreateNote(req.Title, req.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Sync with SemWare
	go func() {
		if _, err := h.semware.UpsertDocument(strconv.FormatInt(note.ID, 10), note.Content); err != nil {
			log.Printf("Failed to sync note %d with SemWare: %v", note.ID, err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(note)
}

func (h *Handler) GetNote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	note, err := h.db.GetNote(id)
	if err != nil {
		http.Error(w, "Note not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(note)
}

func (h *Handler) GetAllNotes(w http.ResponseWriter, r *http.Request) {
	notes, err := h.db.GetAllNotes()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

func (h *Handler) UpdateNote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	var req UpdateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	note, err := h.db.UpdateNote(id, req.Title, req.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Sync with SemWare
	go func() {
		if _, err := h.semware.UpsertDocument(strconv.FormatInt(note.ID, 10), note.Content); err != nil {
			log.Printf("Failed to sync note %d with SemWare: %v", note.ID, err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(note)
}

func (h *Handler) DeleteNote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	if err := h.db.DeleteNote(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete from SemWare
	go func() {
		if err := h.semware.DeleteDocument(strconv.FormatInt(id, 10)); err != nil {
			log.Printf("Failed to delete note %d from SemWare: %v", id, err)
		}
	}()

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) SearchNotes(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	notes, err := h.db.SearchNotes(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

// RelatedNoteResponse represents a note with its similarity score
type RelatedNoteResponse struct {
	Note  *database.Note `json:"note"`
	Score float64        `json:"score"`
}

// GetRelatedNotes returns related notes for a given note ID
func (h *Handler) GetRelatedNotes(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	// Get query parameters
	thresholdStr := r.URL.Query().Get("threshold")

	threshold := 0.3 // default threshold
	if thresholdStr != "" {
		if t, err := strconv.ParseFloat(thresholdStr, 64); err == nil {
			threshold = t
		}
	}

	// Get similar documents from SemWare
	semwareResponse, err := h.semware.GetSimilarDocuments(strconv.FormatInt(id, 10), threshold)
	if err != nil {
		log.Printf("Failed to get similar documents for note %d: %v", id, err)
		http.Error(w, "Failed to get related notes", http.StatusInternalServerError)
		return
	}

	// Get the actual note objects for the related note IDs
	var relatedNotes []RelatedNoteResponse
	for _, result := range semwareResponse.SimilarResults {
		noteID, err := strconv.ParseInt(result.ID, 10, 64)
		if err != nil {
			continue
		}

		note, err := h.db.GetNote(noteID)
		if err != nil {
			continue // Skip if note not found
		}

		relatedNotes = append(relatedNotes, RelatedNoteResponse{
			Note:  note,
			Score: result.Score,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(relatedNotes)
}

// SemanticSearchResponse represents a note with its similarity score from semantic search
type SemanticSearchResponse struct {
	Note  *database.Note `json:"note"`
	Score float64        `json:"score"`
}

// SemanticSearch performs semantic search across all notes
func (h *Handler) SemanticSearch(w http.ResponseWriter, r *http.Request) {
	// Get query parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		log.Printf("SemanticSearch: Missing query parameter")
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Printf("SemanticSearch: Query='%s'", query)

	thresholdStr := r.URL.Query().Get("threshold")

	threshold := 0.3 // default threshold (30% similarity)
	if thresholdStr != "" {
		if t, err := strconv.ParseFloat(thresholdStr, 64); err == nil {
			threshold = t
		}
	}

	log.Printf("SemanticSearch: threshold=%f", threshold)

	// Perform semantic search using SemWare
	semwareResponse, err := h.semware.SemanticSearch(query, threshold)
	if err != nil {
		log.Printf("SemanticSearch: SemWare error: %v", err)
		http.Error(w, fmt.Sprintf("Failed to perform semantic search: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("SemanticSearch: SemWare returned %d results", len(semwareResponse.SimilarResults))

	// Convert SemWare results to our response format
	var searchResults []SemanticSearchResponse
	for _, result := range semwareResponse.SimilarResults {
		// Convert document ID back to note ID
		noteID, err := strconv.ParseInt(result.ID, 10, 64)
		if err != nil {
			log.Printf("SemanticSearch: Failed to parse note ID %s: %v", result.ID, err)
			continue
		}

		// Get the note from database
		note, err := h.db.GetNote(noteID)
		if err != nil {
			log.Printf("SemanticSearch: Failed to get note %d: %v", noteID, err)
			continue
		}

		searchResults = append(searchResults, SemanticSearchResponse{
			Note:  note,
			Score: result.Score,
		})
	}

	log.Printf("SemanticSearch: Returning %d results", len(searchResults))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(searchResults)
}

// Supported image MIME types
var supportedMimeTypes = map[string]bool{
	"image/jpeg":    true,
	"image/jpg":     true,
	"image/png":     true,
	"image/svg+xml": true,
	"image/gif":     true,
	"image/webp":    true,
}

// UploadAttachment handles file uploads for attachments
func (h *Handler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		log.Printf("Failed to parse multipart form: %v", err)
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get the uploaded file
	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("No file uploaded: %v", err)
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Log upload attempt
	log.Printf("Uploading file: %s (%s, %d bytes)", header.Filename, header.Header.Get("Content-Type"), header.Size)

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	if !supportedMimeTypes[contentType] {
		log.Printf("Unsupported file type: %s", contentType)
		http.Error(w, "Unsupported file type", http.StatusBadRequest)
		return
	}

	// Validate file size (max 5MB)
	if header.Size > 5<<20 {
		log.Printf("File too large: %d bytes", header.Size)
		http.Error(w, "File too large (max 5MB)", http.StatusBadRequest)
		return
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	uniqueID := generateUniqueID()
	baseFilename := uniqueID + ext
	filename := generateUniqueFilename("attachments", baseFilename)
	filePath := filepath.Join("attachments", filename)

	// Ensure attachments directory exists
	if err := os.MkdirAll("attachments", 0755); err != nil {
		log.Printf("Failed to create attachments directory: %v", err)
		http.Error(w, "Failed to create attachments directory", http.StatusInternalServerError)
		return
	}

	// Create the file
	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("Failed to create file %s: %v", filePath, err)
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the destination file
	if _, err := io.Copy(dst, file); err != nil {
		log.Printf("Failed to save file %s: %v", filePath, err)
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Generate URL for the file
	fileURL := fmt.Sprintf("/api/attachments/%s", filename)

	// Save attachment metadata to database
	attachment, err := h.db.CreateAttachment(
		filename,
		header.Filename,
		contentType,
		filePath,
		fileURL,
		header.Size,
	)
	if err != nil {
		// Clean up the file if database save fails
		log.Printf("Failed to save attachment metadata, cleaning up file %s: %v", filePath, err)
		os.Remove(filePath)
		http.Error(w, "Failed to save attachment metadata", http.StatusInternalServerError)
		return
	}

	// Log successful upload
	log.Printf("Successfully uploaded attachment: %s -> %s", header.Filename, filename)

	// Return the attachment info
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(attachment)
}

// GetAllAttachments returns all attachments
func (h *Handler) GetAllAttachments(w http.ResponseWriter, r *http.Request) {
	attachments, err := h.db.GetAllAttachments()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(attachments)
}

// DeleteAttachment handles attachment deletion
func (h *Handler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid attachment ID", http.StatusBadRequest)
		return
	}

	// Get attachment info before deletion for file cleanup
	attachment, err := h.db.GetAttachment(id)
	if err != nil {
		http.Error(w, "Attachment not found", http.StatusNotFound)
		return
	}

	// Delete from database
	if err := h.db.DeleteAttachment(id); err != nil {
		log.Printf("Failed to delete attachment from database: %v", err)
		http.Error(w, "Failed to delete attachment", http.StatusInternalServerError)
		return
	}

	// Delete file from disk
	if err := os.Remove(attachment.Path); err != nil {
		log.Printf("Failed to delete file %s: %v", attachment.Path, err)
		// Don't return error here as the database deletion was successful
		// The file will be cleaned up later by the cleanup process
	}

	log.Printf("Successfully deleted attachment: %s", attachment.OriginalName)

	w.WriteHeader(http.StatusNoContent)
}

// ServeAttachment serves uploaded files
func (h *Handler) ServeAttachment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	filename := vars["filename"]

	// Validate filename to prevent directory traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		log.Printf("Invalid filename attempted: %s", filename)
		http.Error(w, "Invalid filename", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join("attachments", filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Printf("File not found: %s", filePath)
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Set appropriate headers for image files
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".webp":
		w.Header().Set("Content-Type", "image/webp")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	// Set cache headers for better performance
	w.Header().Set("Cache-Control", "public, max-age=31536000") // 1 year

	// Serve the file
	http.ServeFile(w, r, filePath)
}

// CleanupOrphanedFiles removes files that exist on disk but not in the database
func (h *Handler) CleanupOrphanedFiles() error {
	// This is a placeholder for future implementation
	// In a production system, you might want to run this periodically
	// to clean up files that were uploaded but not saved to the database
	return nil
}

// generateUniqueID generates a unique 16-character hex string
func generateUniqueID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// generateUniqueFilename ensures a unique filename by appending numbers if the file already exists
func generateUniqueFilename(dir, filename string) string {
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	counter := 1
	newFilename := filename

	for {
		filePath := filepath.Join(dir, newFilename)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			// File doesn't exist, we can use this filename
			break
		}
		// File exists, try with counter
		newFilename = fmt.Sprintf("%s_%d%s", base, counter, ext)
		counter++
	}

	return newFilename
}

func (h *Handler) SetupRoutes(router *mux.Router) {
	// API routes
	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/notes", h.CreateNote).Methods("POST")
	api.HandleFunc("/notes", h.GetAllNotes).Methods("GET")
	api.HandleFunc("/notes/search", h.SearchNotes).Methods("GET")
	api.HandleFunc("/notes/semantic-search", h.SemanticSearch).Methods("GET")
	api.HandleFunc("/notes/{id}", h.GetNote).Methods("GET")
	api.HandleFunc("/notes/{id}", h.UpdateNote).Methods("PUT")
	api.HandleFunc("/notes/{id}", h.DeleteNote).Methods("DELETE")
	api.HandleFunc("/notes/{id}/related", h.GetRelatedNotes).Methods("GET")

	// Attachment routes
	api.HandleFunc("/attachments/upload", h.UploadAttachment).Methods("POST")
	api.HandleFunc("/attachments/all", h.GetAllAttachments).Methods("GET")
	api.HandleFunc("/attachments/{id}", h.DeleteAttachment).Methods("DELETE")
	api.HandleFunc("/attachments/{filename}", h.ServeAttachment).Methods("GET")
}
