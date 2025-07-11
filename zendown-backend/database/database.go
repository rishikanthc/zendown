package database

import (
	"database/sql"
	"time"

	_ "modernc.org/sqlite"
)

type Note struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Collection struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type NoteCollection struct {
	NoteID       int64 `json:"note_id"`
	CollectionID int64 `json:"collection_id"`
}

type Attachment struct {
	ID           int64     `json:"id"`
	Filename     string    `json:"filename"`
	OriginalName string    `json:"original_name"`
	MimeType     string    `json:"mime_type"`
	Size         int64     `json:"size"`
	Path         string    `json:"path"`
	URL          string    `json:"url"`
	CreatedAt    time.Time `json:"created_at"`
}

type DB struct {
	*sql.DB
}

func NewDB(dbPath string) (*DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	if err := createTables(db); err != nil {
		return nil, err
	}

	return &DB{db}, nil
}

func createTables(db *sql.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS notes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS collections (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS note_collections (
		note_id INTEGER NOT NULL,
		collection_id INTEGER NOT NULL,
		PRIMARY KEY (note_id, collection_id),
		FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
		FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		filename TEXT NOT NULL,
		original_name TEXT NOT NULL,
		mime_type TEXT NOT NULL,
		size INTEGER NOT NULL,
		path TEXT NOT NULL,
		url TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- Create indexes for efficient querying
	CREATE INDEX IF NOT EXISTS idx_note_collections_note_id ON note_collections(note_id);
	CREATE INDEX IF NOT EXISTS idx_note_collections_collection_id ON note_collections(collection_id);
	CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
	`

	_, err := db.Exec(query)
	return err
}

// Collection methods
func (db *DB) CreateCollection(name string) (*Collection, error) {
	query := `
	INSERT INTO collections (name, created_at)
	VALUES (?, CURRENT_TIMESTAMP)
	`

	result, err := db.Exec(query, name)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return db.GetCollection(id)
}

func (db *DB) GetCollection(id int64) (*Collection, error) {
	query := `
	SELECT id, name, created_at
	FROM collections
	WHERE id = ?
	`

	collection := &Collection{}
	err := db.QueryRow(query, id).Scan(
		&collection.ID,
		&collection.Name,
		&collection.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return collection, nil
}

func (db *DB) GetCollectionByName(name string) (*Collection, error) {
	query := `
	SELECT id, name, created_at
	FROM collections
	WHERE name = ?
	`

	collection := &Collection{}
	err := db.QueryRow(query, name).Scan(
		&collection.ID,
		&collection.Name,
		&collection.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return collection, nil
}

func (db *DB) GetAllCollections() ([]*Collection, error) {
	query := `
	SELECT id, name, created_at
	FROM collections
	ORDER BY name ASC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var collections []*Collection
	for rows.Next() {
		collection := &Collection{}
		err := rows.Scan(
			&collection.ID,
			&collection.Name,
			&collection.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		collections = append(collections, collection)
	}

	return collections, nil
}

func (db *DB) DeleteCollection(id int64) error {
	query := `DELETE FROM collections WHERE id = ?`
	_, err := db.Exec(query, id)
	return err
}

// Note-Collection relationship methods
func (db *DB) AddNoteToCollection(noteID, collectionID int64) error {
	query := `
	INSERT OR IGNORE INTO note_collections (note_id, collection_id)
	VALUES (?, ?)
	`

	_, err := db.Exec(query, noteID, collectionID)
	return err
}

func (db *DB) RemoveNoteFromCollection(noteID, collectionID int64) error {
	query := `
	DELETE FROM note_collections
	WHERE note_id = ? AND collection_id = ?
	`

	_, err := db.Exec(query, noteID, collectionID)
	return err
}

func (db *DB) GetNoteCollections(noteID int64) ([]*Collection, error) {
	query := `
	SELECT c.id, c.name, c.created_at
	FROM collections c
	JOIN note_collections nc ON c.id = nc.collection_id
	WHERE nc.note_id = ?
	ORDER BY c.name ASC
	`

	rows, err := db.Query(query, noteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var collections []*Collection
	for rows.Next() {
		collection := &Collection{}
		err := rows.Scan(
			&collection.ID,
			&collection.Name,
			&collection.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		collections = append(collections, collection)
	}

	return collections, nil
}

func (db *DB) GetNotesByCollection(collectionID int64) ([]*Note, error) {
	query := `
	SELECT n.id, n.title, n.content, n.created_at, n.updated_at
	FROM notes n
	JOIN note_collections nc ON n.id = nc.note_id
	WHERE nc.collection_id = ?
	ORDER BY n.updated_at DESC
	`

	rows, err := db.Query(query, collectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []*Note
	for rows.Next() {
		note := &Note{}
		err := rows.Scan(
			&note.ID,
			&note.Title,
			&note.Content,
			&note.CreatedAt,
			&note.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}

	return notes, nil
}

func (db *DB) GetOrCreateCollection(name string) (*Collection, error) {
	// Try to get existing collection
	collection, err := db.GetCollectionByName(name)
	if err == nil {
		return collection, nil
	}

	// If not found, create new collection
	return db.CreateCollection(name)
}

func (db *DB) CreateNote(title, content string) (*Note, error) {
	query := `
	INSERT INTO notes (title, content, created_at, updated_at)
	VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`

	result, err := db.Exec(query, title, content)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return db.GetNote(id)
}

func (db *DB) GetNote(id int64) (*Note, error) {
	query := `
	SELECT id, title, content, created_at, updated_at
	FROM notes
	WHERE id = ?
	`

	note := &Note{}
	err := db.QueryRow(query, id).Scan(
		&note.ID,
		&note.Title,
		&note.Content,
		&note.CreatedAt,
		&note.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return note, nil
}

func (db *DB) GetAllNotes() ([]*Note, error) {
	query := `
	SELECT id, title, content, created_at, updated_at
	FROM notes
	ORDER BY updated_at DESC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []*Note
	for rows.Next() {
		note := &Note{}
		err := rows.Scan(
			&note.ID,
			&note.Title,
			&note.Content,
			&note.CreatedAt,
			&note.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}

	return notes, nil
}

func (db *DB) UpdateNote(id int64, title, content string) (*Note, error) {
	query := `
	UPDATE notes
	SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
	WHERE id = ?
	`

	_, err := db.Exec(query, title, content, id)
	if err != nil {
		return nil, err
	}

	return db.GetNote(id)
}

func (db *DB) DeleteNote(id int64) error {
	query := `DELETE FROM notes WHERE id = ?`
	_, err := db.Exec(query, id)
	return err
}

func (db *DB) SearchNotes(query string) ([]*Note, error) {
	sqlQuery := `
	SELECT id, title, content, created_at, updated_at
	FROM notes
	WHERE title LIKE ? OR content LIKE ?
	ORDER BY updated_at DESC
	`

	searchTerm := "%" + query + "%"
	rows, err := db.Query(sqlQuery, searchTerm, searchTerm)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []*Note
	for rows.Next() {
		note := &Note{}
		err := rows.Scan(
			&note.ID,
			&note.Title,
			&note.Content,
			&note.CreatedAt,
			&note.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}

	return notes, nil
}

func (db *DB) CreateAttachment(filename, originalName, mimeType, path, url string, size int64) (*Attachment, error) {
	query := `
	INSERT INTO attachments (filename, original_name, mime_type, size, path, url, created_at)
	VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`

	result, err := db.Exec(query, filename, originalName, mimeType, size, path, url)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return db.GetAttachment(id)
}

func (db *DB) GetAttachment(id int64) (*Attachment, error) {
	query := `
	SELECT id, filename, original_name, mime_type, size, path, url, created_at
	FROM attachments
	WHERE id = ?
	`

	attachment := &Attachment{}
	err := db.QueryRow(query, id).Scan(
		&attachment.ID,
		&attachment.Filename,
		&attachment.OriginalName,
		&attachment.MimeType,
		&attachment.Size,
		&attachment.Path,
		&attachment.URL,
		&attachment.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return attachment, nil
}

func (db *DB) DeleteAttachment(id int64) error {
	query := `DELETE FROM attachments WHERE id = ?`
	_, err := db.Exec(query, id)
	return err
}

func (db *DB) GetAllAttachments() ([]*Attachment, error) {
	query := `
	SELECT id, filename, original_name, mime_type, size, path, url, created_at
	FROM attachments
	ORDER BY created_at DESC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []*Attachment
	for rows.Next() {
		attachment := &Attachment{}
		err := rows.Scan(
			&attachment.ID,
			&attachment.Filename,
			&attachment.OriginalName,
			&attachment.MimeType,
			&attachment.Size,
			&attachment.Path,
			&attachment.URL,
			&attachment.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		attachments = append(attachments, attachment)
	}

	return attachments, nil
}
