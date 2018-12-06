const { buildSchema } = require('graphql');

module.exports = buildSchema(`
    type PostData {
        posts: [Post!]
        totalPosts: Int!
    }

    type Post {
        _id: ID!
        title: String!
        content: String!
        imageUrl: String!
        creator: User
        createdAt: String!
        updatedAt: String!
    }

    type AuthData {
        token: String!
        userId: String!
    }

    type User{
        _id: ID!
        name: String!
        email: String!
        password: String
        status: String!
        posts: [Post!]
    }

    input UserInputData {
        email: String!
        name: String!
        password: String!
    }

    input PostInputData {
        title: String!
        content: String!
        imageUrl: String!
    }

    type RootQuery {
        login(email:String!, password: String!): AuthData!
        getPosts(currentPage: Int!): PostData!
        getPost(id:String!): Post!
    }

    type RootMutation {
        createUser(userInput:UserInputData): User!
        createPost(postInput: PostInputData): Post!
        updatePost(id:ID!, postInput:PostInputData!): Post!
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }
`)