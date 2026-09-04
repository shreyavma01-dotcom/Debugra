FROM node:20-alpine
WORKDIR /workspace
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["tail","-f","/dev/null"]
