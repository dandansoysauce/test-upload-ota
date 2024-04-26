import { useState, useRef } from 'react';

import * as zip from "@zip.js/zip.js";

function FileUpload() {
  const [file, setFile] = useState(null); // zip file to upload
  const [files, setFiles] = useState([]); // contents of the zip file
  const [directory, setDirectory] = useState(null);
  const [uploading, setUploading] = useState(false); // uploading status
  const [paused, setPaused] = useState(false); // paused status
  const [timers, setTimers] = useState([]); // timers to simulate uploads

  const directoryRef = useRef();
  const filesRenameRef = useRef([]); // refs for rename input

  /**
   * Handles file unzipping when attaching file to input.
   * @param {MouseEvent} ev mouse event
   */
  const handleFilenput = async (ev) => {
    const zipFile = ev.target.files[0];
    setFile(zipFile);
    
    if (zipFile) {
      const fileBlob = new Blob([zipFile]); // file to blob
      const zipFileReader = new zip.BlobReader(fileBlob); // feed blob to zip.js blobreader
      const zipReader = new zip.ZipReader(zipFileReader); // read zip file

      // get file entries
      zipReader.getEntries().then(entries => {
        const entryFiles = [];
        
        for (const entry of entries) {
          entryFiles.push({
            filename: entry.filename,
            size: entry.uncompressedSize,
            processed: false
          });
        }

        setFiles(entryFiles);
      });

      await zipReader.close();
    }
  }

  const handleOpenDirectoryChooser = async () => {
    // limited browser availability
    // see: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
    // there is currently no way to fully read a user's file system by design
    // see: https://github.com/WICG/file-system-access/issues/282
    // see: https://github.com/WICG/file-system-access/issues/156
    const dirHandle = await window.showDirectoryPicker();
    setDirectory(dirHandle.name);
  }

  /**
   * Creates a copy of a file.
   * @param {File} file file to duplicate
   */
  const handleDuplicateFile = (file) => {
    const copyReg = /(\s?)\(Copy(\s?)(\d?)\)/g;
    const cloneFile = structuredClone(file); // clone file
    cloneFile.filename = cloneFile.filename.replace(copyReg, ''); // remove the (Copy N) text
    const clonedFilenameSplit = cloneFile.filename.split('.'); // split cloned file

    const checkCopies = files.filter(f => f.filename.includes(`${clonedFilenameSplit[0]} (Copy`)); // check for copies in the list
    
    if (checkCopies.length === 0) {
      // straight up put (Copy) when there's no duplicate
      cloneFile.filename = `${clonedFilenameSplit[0]} (Copy).${clonedFilenameSplit[1]}`;
    } else {
      // add number to copy text
      cloneFile.filename = `${clonedFilenameSplit[0]} (Copy ${checkCopies.length + 1}).${clonedFilenameSplit[1]}`;
    }
    
    // add the copy
    setFiles([
      ...files,
      cloneFile
    ]);
  }

  /**
   * Sets the file name to the value of rename text input.
   * @param {number} index index from list
   * @param {string} filename file name
   */
  const handleSetName = (index, filename) => {
    filesRenameRef.current[index].value = filename;
  }

  /**
   * Renames the file.
   * @param {number} idx index from list
   */
  const handleRename = (idx) => {
    const newFiles = files.map((file, index) => {
      if (idx === index) {
        // set the value of the rename text input
        file.filename = filesRenameRef.current[idx].value;
      }

      return file;
    });

    setFiles(newFiles);
  }

  /**
   * Handles file upload. Each file has its own timer in order to simulate individual progress.
   */
  const uploadFiles = () => {
    // Loop through each file
    for (const [idx, file] of files.entries()) {
      if (!file.processed) { // check if file has been processed for pause/resume function
        // timer for each file
        const fileTimer = setTimeout(() => {
          const newFiles = files.map((value, index) => {
            if (index === idx) {
              value.processed = true;
            }

            return value;
          });

          setFiles(newFiles);
        }, file.size * 0.001);

        setTimers((oldValue) => [...oldValue, fileTimer]);
      }
    }
  }

  /**
   * Handles upload click event.
   */
  const handleUpload = async () => {
    if (!directory) {
      alert('Please choose a destination folder');
      return;
    }

    setTimers([]); // clear timers for every click
    if (uploading && !paused) { // pause
      setPaused(true);
      for (const s of timers) {
        clearTimeout(s);
      }
    } else if (uploading && paused) { // resume
      setPaused(false);
      uploadFiles();
    } else {
      setUploading(true); // start upload
      uploadFiles();
    }
  }

  return (
    <div>
      <div className="input-group mb-3">
        <input type="file" 
          className="form-control"
          onInput={handleFilenput}
          multiple={false}
          accept=".zip,.rar,.7zip,application/octet-stream" />
      </div>
      <div className="t-directory-chooser mb-3">
        <button className="btn btn-outline-secondary w-100" 
          htmlFor="directoryChooser"
          onClick={handleOpenDirectoryChooser}
          ref={directoryRef}>
            {!directory && 'Choose destination folder'}
            {directory && `Saving to "${directory}" folder`}
        </button>
      </div>
      { file && 
        <div className="list-group mb-3">
          <div className="t-filelist-container">
            {
              files.map((file, index) =>
                <li key={file.filename} className="list-group-item d-flex justify-content-between align-items-center">
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">{file.filename}</div>
                    <div className="d-flex flex-row mt-1">
                      <button type="button" className="btn btn-secondary btn-sm me-2 dropdown-toggle"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        onClick={() => handleSetName(index, file.filename)}>
                          Rename
                      </button>
                      <div className="dropdown-menu p-3">
                        <div className="mb-3">
                          <input type="email" className="form-control" ref={el => filesRenameRef.current[index] = el} />
                        </div>
                        <button type="button" className="btn btn-primary" onClick={() => handleRename(index)}>Okay</button>
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDuplicateFile(file)}>Duplicate</button>
                    </div>
                  </div>
                  { uploading && !file.processed &&
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  }
                  { uploading && file.processed &&
                    <span className="text-light">
                      <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path fill="currentColor" d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>
                    </span>
                  }
                </li>
              )
            }
          </div>
        </div>
      }
      <div className="d-flex flex-row">
        <button type="button" className="btn btn-primary me-2" onClick={handleUpload}>
          { !uploading && !paused && 'Upload' }
          { uploading && paused && 'Paused' }
          { uploading && !paused && files.filter(x => x.processed).length !== files.length && 'Uploading' }
          { uploading && !paused && files.filter(x => x.processed).length === files.length && 'Done' }
        </button>
      </div>
    </div>
  );
}

export default FileUpload;
