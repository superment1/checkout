from functools import wraps
from flask import request, jsonify
import os

def require_api_key():
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            api_key = request.headers.get("x-api-key")
            if api_key != os.getenv("ADMIN_API_KEY"):
                return jsonify({"error": "Unauthorized"}), 401
            return f(*args, **kwargs)
        return decorated_function
    return decorator