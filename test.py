import pyodbc
import json
import os

# --- ۱. تنظیمات اتصال (Connection String) ---
# این بخش را با همان تنظیمات مطمئنی که در تست کار کرد، به‌روزرسانی کنید.
conn_str = (
    r'DRIVER={ODBC Driver 17 for SQL Server};' # یا هر درایوری که در تست کار کرد (مثلا {SQL Server})
    r'SERVER=DESKTOP-M2LCAUM;'
    r'DATABASE=BOOK&MBTI;'
    r'Trusted_Connection=yes;' # یا از UID/PWD استفاده کنید اگر در تست از آن استفاده کردید
)

# اگر در پوشه پروژه، پوشه 'data' وجود ندارد، آن را ایجاد کنید
output_dir = 'data'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# --- ۲. تعریف کوئری‌ها و فایل‌های خروجی ---
queries = {
    'books.json': (
        "SELECT BookID, Title, Author, Description, CoverImagePath FROM dbo.Books ORDER BY BookID"
    ),
    'genres.json': (
        "SELECT GenreID, GenreName FROM dbo.Genres ORDER BY GenreID"
    ),
    'mbti_types.json': (
        "SELECT TypeID, TypeName, TypeDescription FROM dbo.MBTI_Types ORDER BY TypeID"
    ),
    'book_genres.json': (
        "SELECT BookID, GenreID FROM dbo.Book_Genres ORDER BY BookID, GenreID"
    ),
    'mbti_recs.json': (
        "SELECT TypeID, GenreID FROM dbo.MBTI_Genre_Recommendations ORDER BY TypeID, GenreID"
    )
}

# --- ۳. تابع اصلی برای خواندن و ذخیره JSON ---
def export_to_json():
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        print("✅ اتصال با موفقیت برقرار شد. در حال استخراج داده‌ها...")

        for filename, sql_query in queries.items():
            
            cursor.execute(sql_query)
            
            columns = [column[0] for column in cursor.description]
            
            # تبدیل نتایج به لیست دیکشنری (فرمت مورد نیاز JSON)
            data = []
            for row in cursor.fetchall():
                record = dict(zip(columns, row))
                data.append(record)
            
            # ذخیره داده‌ها به صورت JSON در پوشه data
            output_path = os.path.join(output_dir, filename)
            with open(output_path, 'w', encoding='utf-8') as f:
                # ensure_ascii=False تضمین می‌کند که کاراکترهای فارسی حفظ شوند
                json.dump(data, f, ensure_ascii=False, indent=4)
                
            print(f"✔️ فایل {filename} با {len(data)} رکورد با موفقیت ایجاد شد.")
            
        cursor.close()
        conn.close()
        print("🎉 عملیات انتقال داده با موفقیت به پایان رسید.")

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"❌ یک خطای اجرای کوئری رخ داد: {sqlstate}")
        # اگر این خطا رخ دهد، یعنی کوئری‌ها مشکل دارند که بعید است.

# اجرای تابع
export_to_json()