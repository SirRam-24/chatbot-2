import json
import base64
import requests
from flask import Flask, render_template, request, Response, stream_with_context
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"


API_KEY = "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"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "text/event-stream"
}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    
    system_instruction = """Your are Ai Freindly Chatbot For Hapies You was Developed By K.Sri Pavithran Your Work is to Answer Question Related Placements , Skills , Hackathons , CGPA .."""

    # Insert system prompt at the beginning of the messages list
    full_messages = [{"role": "system", "content": system_instruction}] + messages
    
    payload = {
        "model": "meta/llama-3.1-70b-instruct",
        "messages": full_messages,
        "max_tokens": 16384,
        "temperature": 0.60,
        "top_p": 0.95,
        "stream": True,
        
    }
    
    def generate():
        response = requests.post(INVOKE_URL, headers=headers, json=payload, stream=True)
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode("utf-8")
                
                yield decoded_line + "\n\n"
                
    return Response(stream_with_context(generate()), content_type="text/event-stream")

if __name__ == "__main__":
    app.run(debug=True, port=5000)
