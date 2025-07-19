from werkzeug.middleware.dispatcher import DispatcherMiddleware
from app import app  
from flask import Flask

base = Flask(__name__)
application = DispatcherMiddleware(base, {
    "/checkout": app 
})