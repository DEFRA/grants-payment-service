#!/bin/bash
set -e

echo "🚀 Initializing SNS + SQS in LocalStack..."

# SQS Queues we listen to
declare -A QUEUES=(
  [gps__sqs__create_payment.fifo]="gps__sqs__create_payment.fifo"
 )

# SNS Topics we publish to
declare -A TOPICS=()

# Associative arrays for ARNs and URLs
declare -A TOPIC_ARNS
declare -A QUEUE_URLS
declare -A QUEUE_ARNS

# Create SNS topics
for key in "${!TOPICS[@]}"; do
  topic_name="${TOPICS[$key]}"
  arn=$(awslocal sns create-topic --name "$topic_name" --attributes FifoTopic=true,ContentBasedDeduplication=true --query 'TopicArn' --output text)
  TOPIC_ARNS[$key]="$arn"
  echo "✅ Created topic: $arn"
done

# Create mock SNS topics tests can use to publish and listen to
for key in "${!QUEUES[@]}"; do
  topic_name="$key"
  arn=$(awslocal sns create-topic --name "$topic_name" --attributes FifoTopic=true,ContentBasedDeduplication=true --query 'TopicArn' --output text)
  TOPIC_ARNS[$key]="$arn"
  echo "✅ Created topic: $arn"
done

# Create SQS queues and get ARNs
for key in "${!QUEUES[@]}"; do
  queue_name="${QUEUES[$key]}"
  url=$(awslocal sqs create-queue --queue-name "$queue_name" --endpoint-url=$AWS_ENDPOINT --attributes FifoQueue=true,ContentBasedDeduplication=true --query 'QueueUrl' --output text)
  arn=$(awslocal sqs get-queue-attributes --queue-url "$url" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
  QUEUE_URLS[$key]="$url"
  QUEUE_ARNS[$key]="$arn"
  echo "✅ Created FIFO queue: $url"
done

# Create mock SQS queues tests can use to publish and listen to
for key in "${!TOPICS[@]}"; do
  queue_name="$key"
  url=$(awslocal sqs create-queue --queue-name "$queue_name" --endpoint-url=$AWS_ENDPOINT --attributes FifoQueue=true,ContentBasedDeduplication=true --query 'QueueUrl' --output text)
  arn=$(awslocal sqs get-queue-attributes --queue-url "$url" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
  QUEUE_URLS[$key]="$url"
  QUEUE_ARNS[$key]="$arn"
  echo "✅ Created FIFO queue: $url"
done


wait_for_topic() {
  local arn="$1"
  local name="$2"
  echo "⏳ Waiting for SNS topic to be available: ${name}"
  for i in {1..10}; do
    if awslocal sns get-topic-attributes --topic-arn "$arn" > /dev/null 2>&1; then
      echo "✅ Topic is now available: ${name}"
      return 0
    fi
    echo "🔄 Still waiting for ${name}..."
    sleep 1
  done
  echo "⚠️  Timeout waiting for topic: ${name}"
}

# Ensure all topics are fully registered
for key in "${!TOPICS[@]}"; do
  wait_for_topic "${TOPIC_ARNS[$key]}" "${TOPICS[$key]}"
done

# Create loopback subscription for each topic
for key in "${!TOPICS[@]}"; do
  awslocal sns subscribe \
    --topic-arn "${TOPIC_ARNS[$key]}" \
    --protocol sqs \
    --notification-endpoint "${QUEUE_ARNS[$key]}" \
    --attributes '{ "RawMessageDelivery": "true"}'
  echo "🔗 Subscribed topics queue ${QUEUE_ARNS[$key]} to topic: ${TOPIC_ARNS[$key]}"
done

# Subscribe each queue to its mock topic
for key in "${!QUEUES[@]}"; do
  awslocal sns subscribe \
    --topic-arn "${TOPIC_ARNS[$key]}" \
    --protocol sqs \
    --notification-endpoint "${QUEUE_ARNS[$key]}" \
    --attributes '{ "RawMessageDelivery": "true"}'
  echo "🔗 Subscribed queue ${QUEUE_ARNS[$key]} to topic: ${TOPIC_ARNS[$key]}"
done

echo "✅ SNS and SQS setup complete."
