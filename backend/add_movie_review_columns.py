"""
Migration script to add movie review fields to articles table
"""
import sqlite3
import os

def add_movie_review_columns():
    # Get the database path
    db_path = os.path.join(os.path.dirname(__file__), 'blog_cms.db')
    
    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(articles)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # List of new columns to add
        new_columns = [
            ('review_quick_verdict', 'TEXT'),
            ('review_plot_summary', 'TEXT'),
            ('review_performances', 'TEXT'),
            ('review_what_works', 'TEXT'),
            ('review_what_doesnt_work', 'TEXT'),
            ('review_technical_aspects', 'TEXT'),
            ('review_final_verdict', 'TEXT'),
            ('review_cast', 'TEXT'),
            ('review_director', 'VARCHAR'),
            ('review_genre', 'VARCHAR'),
            ('review_runtime', 'VARCHAR')
        ]
        
        # Add columns if they don't exist
        for column_name, column_type in new_columns:
            if column_name not in columns:
                print(f"Adding column: {column_name}")
                cursor.execute(f"ALTER TABLE articles ADD COLUMN {column_name} {column_type}")
                conn.commit()
                print(f"✓ Added column: {column_name}")
            else:
                print(f"Column {column_name} already exists, skipping...")
        
        print("\n✓ Movie review columns migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_movie_review_columns()
