FROM python:3.11.8-slim

ARG MODULE=module1_code_review
ENV MODULE=${MODULE}

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared utilities
COPY shared/ ./shared/

# Copy the specific module
COPY ${MODULE}/ ./${MODULE}/

# Set working directory to module
WORKDIR /app/${MODULE}

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
