FROM node:14-slim
# Create app directory
RUN mkdir -p /app
WORKDIR /app
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm ci --only=production
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY ./src ./src
# Uncomment the following line if you want to run locally
# COPY .env .env

EXPOSE 8080
CMD [ "npm","run", "prod" ]