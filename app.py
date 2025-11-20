import json
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

def load_data(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return {} if filename.endswith('votes.json') else []
    with open(path, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except:
            return {} if filename.endswith('votes.json') else []

def save_votes_data(data):
    path = os.path.join(DATA_DIR, 'votes.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

GENRES_DATA = load_data('genres.json')
MBTI_TYPES_DATA = load_data('mbti_types.json')
ALL_BOOKS_DATA = load_data('books.json')
VOTES_DATA = load_data('votes.json')
ALL_BOOK_GENRES = load_data('book_genres.json')

tfidf = None
tfidf_matrix = None

if GENRES_DATA:
    genre_descriptions = [g.get('Description', '') for g in GENRES_DATA]
    tfidf = TfididfVectorizer(stop_words='english')
    tfidf_matrix = tfidf.fit_transform(genre_descriptions)

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')


@app.route('/api/vote', methods=['POST'])
def update_vote():
    global VOTES_DATA
    data = request.json
    book_id = str(data.get('book_id'))

    if not book_id:
        return jsonify({"success": False}), 400

    VOTES_DATA[book_id] = VOTES_DATA.get(book_id, 0) + 1
    save_votes_data(VOTES_DATA)

    return jsonify({
        "success": True,
        "new_vote_count": VOTES_DATA[book_id],
        "book_id": book_id
    })


@app.route('/api/recommend-genres', methods=['POST'])
def recommend_genres():
    data = request.json
    type_id = data.get('type_id')

    mbti_type = next((t for t in MBTI_TYPES_DATA if t['TypeID'] == type_id), None)

    top_genre_ids = []
    if mbti_type and tfidf:
        type_desc = mbti_type["TypeDescription"]
        type_vec = tfidf.transform([type_desc])
        similarities = linear_kernel(type_vec, tfidf_matrix).flatten()
        indices = similarities.argsort()[:-4:-1]

        for i in indices:
            if similarities[i] > 0.05:
                top_genre_ids.append(GENRES_DATA[i]['GenreID'])

    recommended_ids = {
        bg['BookID'] for bg in ALL_BOOK_GENRES if bg['GenreID'] in top_genre_ids
    }

    result = []
    for book in ALL_BOOKS_DATA:
        if book["BookID"] in recommended_ids:
            b = dict(book)
            bid = str(book["BookID"])
            b["TotalVotes"] = VOTES_DATA.get(bid, 0)
            result.append(b)

    return jsonify({"recommended_books": result})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)