//
// Copyright © 2024 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//
import {
  type Class,
  type Client,
  type DocumentQuery,
  type Ref,
  type RelatedDocument,
  SortingOrder,
  type WithLookup,
  type Doc,
  getCurrentAccount,
  checkPermission
} from '@hcengineering/core'
import {
  type Document,
  type DocumentSpace,
  DocumentState,
  type DocumentMeta,
  type ProjectDocument,
  type Project
} from '@hcengineering/controlled-documents'
import { type Resources } from '@hcengineering/platform'
import { type ObjectSearchResult, getClient, MessageBox } from '@hcengineering/presentation'
import { showPopup } from '@hcengineering/ui'
import { type PersonAccount } from '@hcengineering/contact'

import CreateDocument from './components/CreateDocument.svelte'
import QmsDocumentWizard from './components/create-doc/QmsDocumentWizard.svelte'
import QmsTemplateWizard from './components/create-doc/QmsTemplateWizard.svelte'
import DocumentStatusTag from './components/document/common/DocumentStatusTag.svelte'
import DocumentSpacePresenter from './components/hierarchy/DocumentSpacePresenter.svelte'
import DocumentPresenter from './components/document/presenters/DocumentPresenter.svelte'
import StatePresenter from './components/document/presenters/StatePresenter.svelte'
import StateFilterValuePresenter from './components/document/presenters/StateFilterValuePresenter.svelte'
import TitlePresenter from './components/document/presenters/TitlePresenter.svelte'
import OwnerPresenter from './components/document/presenters/OwnerPresenter.svelte'
import AddCommentPopup from './components/document/popups/AddCommentPopup.svelte'
import DocumentCommentsPopup from './components/document/popups/DocumentCommentsPopup.svelte'
import ChangeOwnerPopup from './components/document/popups/ChangeOwnerPopup.svelte'
import DeleteCategoryPopup from './components/category/popups/DeleteCategoryPopup.svelte'

import CategoryPresenter from './components/category/presenters/CategoryPresenter.svelte'
import Documents from './components/Documents.svelte'
import DocumentsContainer from './components/DocumentsContainer.svelte'
import MyDocuments from './components/MyDocuments.svelte'
import EditDoc from './components/EditDoc.svelte'
import EditProjectDoc from './components/EditProjectDoc.svelte'
import DocumentItem from './components/DocumentItem.svelte'
import NewDocumentHeader from './components/NewDocumentHeader.svelte'
import DocumentIcon from './components/icons/DocumentIcon.svelte'

import DocumentTemplates from './components/DocumentTemplates.svelte'

import Categories from './components/Categories.svelte'
import EditDocumentCategory from './components/EditDocumentCategory.svelte'

import DocumentTitle from './components/document/DocumentTitle.svelte'
import EditDocContent from './components/document/EditDocContent.svelte'
import DocumentVersionPresenter from './components/document/presenters/DocumentVersionPresenter.svelte'
import DocumentReviewRequest from './components/requests/DocumentReviewRequest.svelte'
import DocumentReviewRequestPresenter from './components/requests/DocumentReviewRequestPresenter.svelte'
import DocumentApprovalRequest from './components/requests/DocumentApprovalRequest.svelte'
import DocumentApprovalRequestPresenter from './components/requests/DocumentApprovalRequestPresenter.svelte'
import ControlledStateFilterValuePresenter from './components/document/presenters/ControlledStateFilterValuePresenter.svelte'
import DocumentMetaPresenter from './components/DocumentMetaPresenter.svelte'
import CreateDocumentsSpace from './components/docspace/CreateDocumentsSpace.svelte'
import CreateDocumentSpaceType from './components/docspace/CreateDocumentSpaceType.svelte'

import Projects from './components/project/Projects.svelte'
import ProjectPresenter from './components/project/ProjectPresenter.svelte'
import ProjectRefPresenter from './components/project/ProjectRefPresenter.svelte'

import documents from './plugin'
import './styles/_colors.scss'
import { resolveLocation } from './navigation'
import {
  getVisibleFilters,
  sortDocumentStates,
  getAllDocumentStates,
  canChangeDocumentOwner,
  canDeleteDocumentCategory,
  canCreateChildTemplate,
  canCreateChildDocument,
  documentIdentifierProvider,
  getControlledDocumentTitle,
  getDocumentMetaLinkFragment,
  createChildDocument,
  createChildTemplate,
  createDocument,
  createTemplate
} from './utils'
import { comment, isCommentVisible } from './text'
import TransferDocumentPopup from './components/document/popups/TransferDocumentPopup.svelte'

export { DocumentStatusTag, DocumentTitle, DocumentVersionPresenter, StatePresenter }

const toObjectSearchResult = (e: WithLookup<DocumentMeta>): ObjectSearchResult => ({
  doc: e,
  title: e.title,
  icon: documents.icon.Document,
  component: DocumentItem
})

async function queryDocumentMeta (
  _class: Ref<Class<DocumentMeta>>,
  client: Client,
  search: string,
  filter?: { in?: RelatedDocument[], nin?: RelatedDocument[] }
): Promise<ObjectSearchResult[]> {
  const q: DocumentQuery<DocumentMeta> = { name: { $like: `%${search}%` } }
  if (filter?.in !== undefined || filter?.nin !== undefined) {
    q._id = {}
    if (filter.in !== undefined) {
      q._id.$in = filter.in?.map((it) => it._id as Ref<DocumentMeta>)
    }
    if (filter.nin !== undefined) {
      q._id.$nin = filter.nin?.map((it) => it._id as Ref<DocumentMeta>)
    }
  }
  return (
    await client.findAll(_class, q, {
      limit: 200
    })
  ).map(toObjectSearchResult)
}

async function deleteDocuments (obj: Document | Document[]): Promise<void> {
  const docs = Array.isArray(obj) ? obj : [obj]
  const docNames = docs.map((d) => `${d.title} (${d.prefix}-${d.seqNumber})`).join(', ')

  showPopup(MessageBox, {
    label: docs.length === 1 ? documents.string.MarkDocAsDeleted : documents.string.MarkDocsAsDeleted,
    message: documents.string.MarkDocAsDeletedConfirm,
    params: { titles: docNames },
    action: async () => {
      const client = getClient()
      for (const doc of docs) {
        await client.update(doc, { state: DocumentState.Deleted })
      }
    }
  })
}

async function archiveDocuments (obj: Document | Document[]): Promise<void> {
  const docs = Array.isArray(obj) ? obj : [obj]
  const docNames = docs.map((d) => `${d.title} (${d.prefix}-${d.seqNumber})`).join(', ')

  showPopup(MessageBox, {
    label: documents.string.ArchiveDocs,
    labelProps: { count: docs.length },
    message: documents.string.ArchiveDocsConfirm,
    params: { titles: docNames },
    action: async () => {
      const client = getClient()
      for (const doc of docs) {
        await client.update(doc, { state: DocumentState.Archived })
      }
    }
  })
}

async function canDeleteDocument (obj?: Doc | Doc[]): Promise<boolean> {
  if (obj == null) {
    return false
  }

  const objs = (Array.isArray(obj) ? obj : [obj]) as Document[]
  const currentUser = getCurrentAccount() as PersonAccount
  const isOwner = objs.every((doc) => doc.owner === currentUser.person)

  if (!isOwner) {
    return false
  }

  return await isLatestDraftDoc(obj)
}

async function canArchiveDocument (obj?: Doc | Doc[]): Promise<boolean> {
  if (obj == null) {
    return false
  }

  const objs = (Array.isArray(obj) ? obj : [obj]) as Document[]
  const currentUser = getCurrentAccount() as PersonAccount
  const isOwner = objs.every((doc) => doc.owner === currentUser.person)

  if (isOwner) {
    return true
  }

  const spaces = new Set(objs.map((doc) => doc.space))

  return await Promise.all(
    Array.from(spaces).map(
      async (space) => await checkPermission(getClient(), documents.permission.ArchiveDocument, space)
    )
  ).then((res) => res.every((r) => r))
}

async function canTransferDocument (obj?: Doc | Doc[]): Promise<boolean> {
  if (obj == null) {
    return false
  }

  const objs = (Array.isArray(obj) ? obj : [obj]) as Document[]
  const spaces = new Set(objs.map((doc) => doc.space))

  return await Promise.all(
    Array.from(spaces).map(
      async (space) => await checkPermission(getClient(), documents.permission.ArchiveDocument, space)
    )
  ).then((res) => res.every((r) => r))
}

async function transferDocuments (selection: Document | Document[]): Promise<void> {
  const objects = Array.isArray(selection) ? selection : [selection]

  const client = getClient()
  const h = client.getHierarchy()

  let sourceDocumentIds: Array<Ref<DocumentMeta>> = []
  let sourceSpaceId: Ref<DocumentSpace> | undefined
  let sourceProjectId: Ref<Project<DocumentSpace>> | undefined

  if (objects.length < 1) return
  if (h.isDerived(objects[0]._class, documents.class.ProjectDocument)) {
    const pjDocs = objects as unknown as ProjectDocument[]
    const pjMeta = await client.findAll(documents.class.ProjectMeta, { _id: { $in: pjDocs.map((d) => d.attachedTo) } })
    const docMeta = await client.findAll(documents.class.DocumentMeta, { _id: { $in: pjMeta.map((d) => d.meta) } })
    sourceDocumentIds = docMeta.map((d) => d._id)
    sourceSpaceId = pjDocs[0].space
    sourceProjectId = pjDocs[0].project
  }

  if (sourceDocumentIds.length < 1) return

  showPopup(TransferDocumentPopup, { sourceDocumentIds, sourceSpaceId, sourceProjectId })
}

async function isLatestDraftDoc (obj?: Doc | Doc[]): Promise<boolean> {
  if (obj == null) {
    return false
  }

  const objs = Array.isArray(obj) ? obj : [obj]

  const client = getClient()
  const h = client.getHierarchy()
  for (const obj of objs) {
    if (!h.isDerived(obj._class, documents.class.Document)) {
      return false
    }

    const doc = obj as Document

    if (doc.state !== DocumentState.Draft) {
      return false
    }

    const { template, seqNumber } = doc
    const latestDoc = await client.findOne(
      documents.class.Document,
      { template, seqNumber },
      {
        sort: {
          major: SortingOrder.Descending,
          minor: SortingOrder.Descending,
          patch: SortingOrder.Descending
        }
      }
    )

    if (latestDoc == null || latestDoc.state !== DocumentState.Draft) {
      return false
    }

    if (latestDoc._id !== doc._id) {
      return false
    }
  }

  return objs.length > 0
}

async function editDocSpace (docSpace: DocumentSpace | undefined): Promise<void> {
  if (docSpace !== undefined) {
    showPopup(CreateDocumentsSpace, { docSpace, clazz: docSpace?._class })
  }
}

export default async (): Promise<Resources> => ({
  component: {
    CreateDocument,
    QmsDocumentWizard,
    QmsTemplateWizard,
    CreateDocumentsSpace,
    CreateDocumentSpaceType,
    DocumentSpacePresenter,
    DocumentPresenter,
    Documents,
    DocumentsContainer,
    DocumentMetaPresenter,
    EditDoc,
    EditProjectDoc,
    TitlePresenter,
    DocumentVersionPresenter,
    StatePresenter,
    OwnerPresenter,
    NewDocumentHeader,
    MyDocuments,
    DocumentTemplates,
    CategoryPresenter,
    Categories,
    EditDocumentCategory,
    EditDocContent,
    DocumentReviewRequest,
    DocumentReviewRequestPresenter,
    DocumentApprovalRequest,
    DocumentApprovalRequestPresenter,
    StateFilterValuePresenter,
    ControlledStateFilterValuePresenter,
    AddCommentPopup,
    DocumentCommentsPopup,
    ChangeOwnerPopup,
    DeleteCategoryPopup,
    Projects,
    ProjectPresenter,
    ProjectRefPresenter,
    DocumentIcon
  },
  completion: {
    DocumentMetaQuery: async (
      client: Client,
      query: string,
      filter?: { in?: RelatedDocument[], nin?: RelatedDocument[] }
    ) => await queryDocumentMeta(documents.class.DocumentMeta, client, query, filter)
  },
  function: {
    // CheckIsDocumentCreationDisabled: getDisablingChecker(document.functionalityItem.CreateDraftQmsDocuments),
    // CheckAreTemplatesDisabled: getDisablingChecker(document.functionalityItem.Templates),
    // CheckAreDomainsDisabled: getDisablingChecker(document.functionalityItem.Domains),
    // CheckIsLibraryDisabled: getDisablingChecker(document.functionalityItem.EffectiveLibrary)
    CanChangeDocumentOwner: canChangeDocumentOwner,
    CanCreateTemplate: canCreateChildTemplate,
    CanCreateDocument: canCreateChildDocument,
    CanCreateChildTemplate: canCreateChildTemplate,
    CanCreateChildDocument: canCreateChildDocument,
    CanDeleteDocumentCategory: canDeleteDocumentCategory,
    GetVisibleFilters: getVisibleFilters,
    DocumentStateSort: sortDocumentStates,
    GetAllDocumentStates: getAllDocumentStates,
    GetDocumentMetaLinkFragment: getDocumentMetaLinkFragment,
    CanDeleteDocument: canDeleteDocument,
    CanArchiveDocument: canArchiveDocument,
    CanTransferDocument: canTransferDocument,
    DocumentIdentifierProvider: documentIdentifierProvider,
    ControlledDocumentTitleProvider: getControlledDocumentTitle,
    Comment: comment,
    IsCommentVisible: isCommentVisible
  },
  actionImpl: {
    CreateChildDocument: createChildDocument,
    CreateChildTemplate: createChildTemplate,
    CreateDocument: createDocument,
    CreateTemplate: createTemplate,
    DeleteDocument: deleteDocuments,
    ArchiveDocument: archiveDocuments,
    TransferDocument: transferDocuments,
    EditDocSpace: editDocSpace
  },
  resolver: {
    Location: resolveLocation
  }
})
